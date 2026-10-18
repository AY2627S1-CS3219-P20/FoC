import { AppError } from "../errors/errors.js";
import { OrderStatus } from "../generated/prisma/client.js";
import { abortReservation, reserveCredits } from "../integrations/credit/credit.client.js";
import { verifySupplierExists } from "../integrations/supplier/supplier.client.js";
import { prisma } from "../libs/prisma.js";
import type { CreateRequestInput, RequesterOrderHistoryQuery, UpdateRequestInput } from "../schemas/order.requester.schema.js";
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

    if (existingOrder.status !== OrderStatus.OPEN ||
        existingOrder.courierId !== null) {
        throw new AppError("This order can no longer be edited", 400);
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