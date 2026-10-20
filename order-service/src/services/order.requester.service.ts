import { randomUUID } from "node:crypto";
import { AppError } from "../errors/errors.js";
import { abortReservation, renewCredits, reserveCredits } from "../integrations/credit/credit.client.js";
import { OrderEventType, OrderStatus } from "../generated/prisma/client.js";
import { verifySupplierExists } from "../integrations/supplier/supplier.client.js";
import { prisma } from "../libs/prisma.js";
import type { CancelRequestInput, CreateRequestInput, FailRequestInput, ReceiveRequestInput, RenewExpiredRequestInput, RequesterOrderHistoryQuery, UpdateRequestInput } from "../schemas/order.requester.schema.js";
import type { ReservationPayload } from "../types/order.types.js";

export async function getRequesterOrderHistoryService(
    requesterId: string,
    query: RequesterOrderHistoryQuery
) {
    const { page, limit, status, sortBy, sortOrder } = query;
    const where = {
        requesterId: requesterId,
        ...(status ? { status: status } : {}), // If status is provided, include it in the where clause; otherwise, don't filter by status
    };

    const [orders, totalCount] = await Promise.all([
        prisma.order.findMany({
            where,
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.order.count({ where }),
    ]);

    return {
        orders,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
        },
    };
};

export async function updateRequestService(
    requesterId: string,
    orderId: string,
    input: UpdateRequestInput,
) {
    const { expectedVersion, ...changes } = input;

    const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
    });

    if (!existingOrder || existingOrder.requesterId !== requesterId) {
        throw new AppError("Order not found", 404);
    }

    // Compare the final pair, including whichever location wasn't changed.
    const pickupSupplierId =
        changes.pickupSupplierId ?? existingOrder.pickupSupplierId;
    const deliverySupplierId =
        changes.deliverySupplierId ?? existingOrder.deliverySupplierId;

    if (pickupSupplierId === deliverySupplierId) {
        throw new AppError(
            "Pickup and delivery locations must be different",
            400,
        );
    }

    // Ensure the order is in OPEN status and has no courier assigned before allowing it to be updated
    if (existingOrder.status !== OrderStatus.OPEN || existingOrder.courierId !== null) {
        throw new AppError(
            "This request has already been accepted and cannot be updated",
            409);
    }

    if (changes.expiryAt && changes.expiryAt <= new Date()) {
        throw new AppError("Expiry date and time must be in the future", 400);
    }

    if (changes.pickupSupplierId) {
        const pickupSupplierExists = await verifySupplierExists(changes.pickupSupplierId);

        if (!pickupSupplierExists) {
            throw new AppError("Pickup supplier does not exist", 400);
        }
    }

    if (changes.deliverySupplierId) {
        const deliverySupplierExists = await verifySupplierExists(changes.deliverySupplierId);
        if (!deliverySupplierExists) {
            throw new AppError("Delivery supplier does not exist", 400);
        }
    }

    // Prepare the data to update, only including fields that are provided in the input
    const dataToUpdate = {
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.description !== undefined && { description: changes.description }),
        ...(changes.pickupSupplierId !== undefined && { pickupSupplierId: changes.pickupSupplierId }),
        ...(changes.deliverySupplierId !== undefined && { deliverySupplierId: changes.deliverySupplierId }),
        ...(changes.remarks !== undefined && { remarks: changes.remarks }),
        ...(changes.expiryAt !== undefined && { expiryAt: changes.expiryAt }),
    };

    return await prisma.$transaction(async (tx) => {
        // This ensure that there is no race condition when updating the order,
        // e.g. A courier accepts the order while the requester is updating it.
        const updatedOrder = await tx.order.updateMany({
            where: {
                id: orderId,
                requesterId: requesterId,
                status: OrderStatus.OPEN,
                courierId: null,
                version: expectedVersion, // Ensure the version matches the expected version for optimistic concurrency control
            },
            data: {
                ...dataToUpdate,
                version: { increment: 1 }, // Increment the version 
            },
        });

        if (updatedOrder.count === 0) {
            throw new AppError("The request changed while you were editing it. Reload and try again.", 409);
        }

        // Return the updated order
        return tx.order.findFirstOrThrow({
            where: { id: orderId },
        });
    });
};

export async function createRequestService(
    requesterId: string,
    input: CreateRequestInput,
) {
    // 1. Validate the expiry date is in the future
    if (input.expiryAt <= new Date()) {
        throw new AppError("Expiry date must be in the future", 400);
    }

    // 2. Verify that the pickup and delivery suppliers exist
    const [pickupSupplierExists, deliverySupplierExists] = await Promise.all([
        verifySupplierExists(input.pickupSupplierId),
        verifySupplierExists(input.deliverySupplierId)
    ]);

    if (!pickupSupplierExists) {
        console.error(`Pickup supplier with ID ${input.pickupSupplierId} does not exist`);
        throw new AppError("Pickup supplier does not exist", 404);
    }

    if (!deliverySupplierExists) {
        console.error(`Delivery supplier with ID ${input.deliverySupplierId} does not exist`);
        throw new AppError("Delivery supplier does not exist", 404);
    }

    // 3. Generate a new order ID 
    const orderId = crypto.randomUUID();

    const reservationInput: ReservationPayload = {
        orderId,
        requesterId,
        amount: input.offeredCredits,
    };

    let reservationId: string | undefined;

    // A timeout may happen after the credit service commits the reservation.
    // Mark it as potentially reserved before making the request.
    let reservationMayExist = false;
    try {
        // 4. Reserve credits for the order
        reservationMayExist = true;
        const reservationResult = await reserveCredits(reservationInput);
        reservationId = reservationResult.id;

        if (!reservationId) {
            throw new AppError(
                "Credit Service returned an invalid reservation",
                502,
            );
        }

        // 5. Create the order request + history + outbox entries atomically in a transaction
        const orderRequest = await prisma.$transaction(async (tx) => {
            const createOrder = await tx.order.create({
                data: {
                    id: orderId,
                    requesterId: requesterId,
                    courierId: null,
                    name: input.name,
                    description: input.description,
                    pickupSupplierId: input.pickupSupplierId,
                    deliverySupplierId: input.deliverySupplierId,
                    offeredCredits: input.offeredCredits,
                    remarks: input.remarks ?? null,
                    expiryAt: input.expiryAt,
                    status: OrderStatus.OPEN,
                    version: 1,
                    creditReservationId: reservationId!,
                },
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: createOrder.id,
                    fromStatus: null,
                    toStatus: OrderStatus.OPEN,
                    changedBy: requesterId,
                    reason: null,
                },
            });

            return createOrder;
        });

        return orderRequest;
    } catch (error) {
        if (reservationMayExist) {
            let existingOrder;
            try {
                existingOrder = await prisma.order.findUnique({
                    where: { id: orderId },
                });
            } catch (lookupError) {
                console.error(`CRITICAL: Failed to look up order ${orderId} after reservation`, lookupError);
                throw error; // Don't abort the reservation if we can't confirm the order's existence
            }

            if (existingOrder) {
                return existingOrder;
            }

            // If the order was not created, attempt to abort the reservation
            if (reservationId) {
                try {
                    console.error(`Attempting to abort reservation ${reservationId} for order ${orderId} due to order creation failure`);
                    await abortReservation({ reservationId, ...reservationInput });
                } catch (abortError) {
                    console.error(`CRITICAL: Failed to abort reservation ${reservationId} for order ${orderId}`, abortError);
                }
            } else {
                // The credit reservations may have timed out after committing the reservation,
                // but its reservation ID was not returned. This needs a manual investigation to ensure the reservation is aborted.
                console.error(`CRITICAL: Reservation may exist for order ${orderId} but no reservation ID was returned. Manual investigation required.`);
            }
        }

        throw error;
    }
};

export async function receiveRequestService(
    requesterId: string,
    orderId: string,
    input: ReceiveRequestInput,
) {
    const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
    });

    // Ensure the order exists and belongs to the requester
    if (!existingOrder || existingOrder.requesterId !== requesterId) {
        throw new AppError("Order not found", 404);
    }

    // Ensure the order is in COMPLETED status and has a courier assigned before allowing it to be marked as received
    if (existingOrder.status !== OrderStatus.COMPLETED || !existingOrder.courierId) {
        throw new AppError(
            "The courier must complete the request before you can mark it as received",
            409,
        );
    }

    // Ensure the order has a credit reservation before allowing it to be marked as received
    if (!existingOrder.creditReservationId) {
        throw new AppError(
            "This request has no credit reservation to transfer to the courier",
            409,
        );
    }

    const eventId = randomUUID();
    const receivedAt = new Date();

    const eventPayload = {
        eventId: eventId,
        eventType: OrderEventType.ORDER_RECEIVED,
        reservationId: existingOrder.creditReservationId,
        orderId: existingOrder.id,
        requesterId: existingOrder.requesterId,
        courierId: existingOrder.courierId,
        amount: existingOrder.offeredCredits,
    };

    return await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.updateMany({
            where: {
                id: orderId,
                requesterId: requesterId,
                status: OrderStatus.COMPLETED,
                courierId: existingOrder.courierId,
                version: input.expectedVersion, // Ensure the version matches the current version for optimistic concurrency control
            },
            data: {
                status: OrderStatus.RECEIVED,
                receivedAt: receivedAt,
                version: { increment: 1 }, // Increment the version for optimistic concurrency control
            },
        });

        if (updatedOrder.count !== 1) {
            throw new AppError("The request changed while being marked as received. Reload and try again.", 409);
        }

        await tx.orderStatusHistory.create({
            data: {
                orderId: orderId,
                fromStatus: OrderStatus.COMPLETED,
                toStatus: OrderStatus.RECEIVED,
                changedBy: requesterId,
                reason: null
            },
        });

        await tx.outboxEvent.create({
            data: {
                id: eventId,
                orderId: orderId,
                eventType: OrderEventType.ORDER_RECEIVED,
                payload: eventPayload,
            },
        });


        return tx.order.findUniqueOrThrow({
            where: { id: orderId },
        });
    });
};

export async function failRequestService(
    requesterId: string,
    orderId: string,
    input: FailRequestInput,
) {
    const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
    });

    // Ensure the order exists and belongs to the requester
    if (!existingOrder || existingOrder.requesterId !== requesterId) {
        throw new AppError("Order not found", 404);
    }

    // Ensure the order is in COMPLETED status and has a courier assigned before allowing it to be marked as failed
    if (existingOrder.status !== OrderStatus.COMPLETED || !existingOrder.courierId) {
        throw new AppError(
            "The courier must complete the request before you can mark it as failed",
            409,
        );
    }

    // Ensure the order has a credit reservation before allowing it to be marked as failed
    if (!existingOrder.creditReservationId) {
        throw new AppError("This order does not have a credit reservation to refund", 409);
    }

    const eventId = randomUUID();
    const failedAt = new Date();

    const eventPayload = {
        eventId: eventId,
        eventType: OrderEventType.ORDER_FAILED,
        reservationId: existingOrder.creditReservationId,
        orderId: existingOrder.id,
        requesterId: existingOrder.requesterId,
        amount: existingOrder.offeredCredits,
    };

    return prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.updateMany({
            where: {
                id: orderId,
                requesterId: requesterId,
                status: OrderStatus.COMPLETED,
                courierId: existingOrder.courierId,
                version: input.expectedVersion, // Ensure the version matches the current version for optimistic concurrency control
            },
            data: {
                status: OrderStatus.FAILED,
                failedAt: failedAt,
                failureReason: input.failureReason,
                version: { increment: 1 }, // Increment the version for optimistic concurrency control
            },
        });

        if (updatedOrder.count !== 1) {
            throw new AppError("The request changed while being marked as failed. Reload and try again.", 409);
        }

        await tx.orderStatusHistory.create({
            data: {
                orderId: orderId,
                fromStatus: OrderStatus.COMPLETED,
                toStatus: OrderStatus.FAILED,
                changedBy: requesterId,
                reason: input.failureReason
            },
        });

        await tx.outboxEvent.create({
            data: {
                id: eventId,
                orderId: orderId,
                eventType: OrderEventType.ORDER_FAILED,
                payload: eventPayload,
            },
        });

        return tx.order.findUniqueOrThrow({
            where: { id: orderId },
        });
    });
};

export async function cancelRequestService(
    requesterId: string,
    orderId: string,
    input: CancelRequestInput,
) {
    const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
    });

    // Ensure the order exists and belongs to the requester
    if (!existingOrder || existingOrder.requesterId !== requesterId) {
        throw new AppError("Order not found", 404);
    }

    // Ensure the order is in OPEN status and has no courier assigned before allowing it to be canceled
    if (existingOrder.status !== OrderStatus.OPEN || existingOrder.courierId !== null) {
        throw new AppError(
            "This request has already been accepted and cannot be canceled",
            409,
        );
    }

    // Ensure the order has a credit reservation before allowing it to be canceled
    if (!existingOrder.creditReservationId) {
        throw new AppError("This order does not have a credit reservation to release", 409);
    }

    const eventId = randomUUID();
    const canceledAt = new Date();
    const reason = input.cancellationReason ?? null;

    const eventPayload = {
        eventId: eventId,
        eventType: OrderEventType.ORDER_CANCELED,
        reservationId: existingOrder.creditReservationId,
        orderId: existingOrder.id,
        requesterId: existingOrder.requesterId,
        amount: existingOrder.offeredCredits,
    };

    return prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.updateMany({
            where: {
                id: orderId,
                requesterId: requesterId,
                courierId: null,
                status: OrderStatus.OPEN,
                version: input.expectedVersion, // Ensure the version matches the current version for optimistic concurrency control
            },
            data: {
                status: OrderStatus.CANCELED,
                canceledAt: canceledAt,
                cancellationReason: reason,
                version: { increment: 1 }, // Increment the version for optimistic concurrency control
            },
        });

        if (updatedOrder.count !== 1) {
            throw new AppError("The request changed while you were canceling it. Reload and try again.", 409);
        }

        await tx.orderStatusHistory.create({
            data: {
                orderId: orderId,
                fromStatus: OrderStatus.OPEN,
                toStatus: OrderStatus.CANCELED,
                changedBy: requesterId,
                reason: reason
            },
        });

        await tx.outboxEvent.create({
            data: {
                id: eventId,
                orderId: orderId,
                eventType: OrderEventType.ORDER_CANCELED,
                payload: eventPayload,
            },
        });

        return tx.order.findUniqueOrThrow({
            where: { id: orderId },
        });
    });
};

export async function renewExpiredRequestService(
    requesterId: string,
    orderId: string,
    input: RenewExpiredRequestInput,
) {
    const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
    });

    // Ensure the order exists and belongs to the requester
    if (!existingOrder || existingOrder.requesterId !== requesterId) {
        throw new AppError("Order not found", 404);
    }

    // If the request is already OPEN and the version is exactly one more than the expected version, 
    // it means that the request has already been renewed by another process.
    // Then we can return the existing order without making any changes.
    if (existingOrder.status === OrderStatus.OPEN &&
        existingOrder.version === input.expectedVersion + 1) {
        return existingOrder;
    }

    // Ensure the order is in EXPIRED status before allowing it to be renewed
    if (existingOrder.status !== OrderStatus.EXPIRED) {
        throw new AppError("Only expired requests can be renewed", 409);
    }

    if (existingOrder.version !== input.expectedVersion) {
        throw new AppError("The request changed while you were renewing it. Reload and try again.", 409);
    }

    if (!existingOrder.creditReservationId) {
        throw new AppError("This order does not have a credit reservation to renew", 409);
    }

    // Generate a unique renewal key for this renewal attempt.
    // This key is used to ensure that the credit service can identify,
    // and handle duplicate renewal requests for the same order.
    const renewalKey = `${orderId}:RENEWAL:${input.expectedVersion}`;

    let newReservation:
        | Awaited<ReturnType<typeof renewCredits>>
        | undefined;

    try {
        newReservation = await renewCredits({
            renewalKey,
            previousReservationId: existingOrder.creditReservationId,
            orderId: existingOrder.id,
            requesterId: requesterId,
            amount: existingOrder.offeredCredits,
        });

        console.log(`Successfully renewed reservation for order ${orderId}. New reservation ID: ${newReservation.id}`);

        return await prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.order.updateMany({
                where: {
                    id: orderId,
                    requesterId: requesterId,
                    status: OrderStatus.EXPIRED,
                    version: input.expectedVersion, // Ensure the version matches the current version for optimistic concurrency control
                },
                data: {
                    status: OrderStatus.OPEN,
                    expiryAt: input.expiryAt,
                    expiredAt: null,
                    creditReservationId: newReservation!.id,
                    version: { increment: 1 }, // Increment the version for optimistic concurrency control
                },
            });

            if (updatedOrder.count !== 1) {
                throw new AppError("The request changed while you were renewing it. Reload and try again.", 409);
            }

            return tx.order.findUniqueOrThrow({
                where: { id: orderId },
            });
        });
    } catch (error) {
        if (newReservation) {
            // If the renewal was successful but the order update failed, we need to check if the order is still expired.
            const currentOrder = await prisma.order.findUnique({
                where: { id: orderId },
            }).catch(() => null);

            // If the current order's credit reservation ID matches the new reservation ID,
            //  it means that the renewal was successful and the order has already been updated.
            if (currentOrder?.creditReservationId === newReservation.id) {
                return currentOrder;
            }

            const orderStillExpired =
                currentOrder?.status === OrderStatus.EXPIRED &&
                currentOrder?.version === input.expectedVersion;

            // If the order is no longer expired, we should abort the new reservation.
            if (!orderStillExpired) {
                try {
                    await abortReservation({
                        reservationId: newReservation.id,
                        orderId: existingOrder.id,
                        requesterId: requesterId,
                        amount: existingOrder.offeredCredits,
                    });
                } catch (abortError) {
                    console.error(`CRITICAL: Failed to abort reservation ${newReservation.id} for order ${orderId}`, abortError);
                }
            }
        }

        throw error;
    }
}