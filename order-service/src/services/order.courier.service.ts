import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import type { GetCourierOrderHistoryInput, GetOpenOrdersInput } from "../schemas/order.courier.schema.js";
import { OrderStatus } from "../generated/prisma/client.js";

// order lifecycle statuses
const STATUS = OrderStatus;

// page limit (max 15 orders per page)
const LIMIT: number = 15;

// lazy update
export async function updateExpiredOrders() {
    // this function finds all orders of the OPEN status, and checks if the current time is past the expiry time
    // for all orders that are expired, perform a prisma transaction to update the status (F8.1.1)
    const now: Date = new Date();
    console.log(now);
    // update database
    const result = await prisma.$transaction(async (tx) => {
        // update rows in the Order table
        const ordersUpdated = await tx.order.updateManyAndReturn({
            where: {
                status: STATUS.OPEN, // still open 
                expiryAt: {
                    lte: now, // currently past the expired time (expiry time <= current time), need to update
                }
            }, 
            data: {
                status: STATUS.EXPIRED, // change to expired status
                version: { increment: 1 }, // increment version number
                expiredAt: now // set the expiredAt timestamp to the time that we marked the order as expired
            }
        })

        console.log(`${ordersUpdated.length} open orders updated to expired`)

        // update OrderStatusHistory table
        for (const order of ordersUpdated) {
            const transactionRecord = await tx.orderStatusHistory.create({
                data: {
                    orderId: order.id,
                    fromStatus: STATUS.OPEN,
                    toStatus: STATUS.EXPIRED, 
                    changedBy: null // indicate system update with null
                }
            });

            // check if transaction record was successfully logged
            if (!transactionRecord) {
                throw new AppError(`Unable to record status update for order ${order.id}`, 500);
            }
        }

        return ordersUpdated;
    });

    return result; 
}

export async function getAllOpenOrders(courierId: string, input: GetOpenOrdersInput) {
    const page: number = input.page;
    const sortBy: string = input.sortBy; // default set to sorting by expiry time
    const sortOrder: string = input.sortOrder; // default set to sorting in ascending order (earliest to latest)
    const filterLocation = input.filterLocation ?? null; // supplier id we want to filter by
    const searchString: string = input.searchString ?? "";

    // ensure that the status of orders are updated
    await updateExpiredOrders();
    
    const orders = await prisma.order.findMany({
        where: { 
            name: {
                contains: searchString, // enforce partial string match
                mode: 'insensitive', // enforce case insensitivity
            }, 
            // as long as delivery/pickup supplier id matches, record will be included in the results
            ...(filterLocation
            ? {
                OR: [
                    { deliverySupplierId: filterLocation },
                    { pickupSupplierId: filterLocation },
                ],
            }
            : {}),
            status: STATUS.OPEN, 
            requesterId: { 
                not: courierId
            }
        },
        orderBy: { [sortBy]: sortOrder }, 
        take: LIMIT, 
        skip: LIMIT * (page - 1),
    });

    const totalCount = await prisma.order.count({
        where: { 
            name: {
                contains: searchString, // enforce partial string match
                mode: 'insensitive', // enforce case insensitivity
            }, 
            // as long as delivery/pickup supplier id matches, record will be included in the results
            ...(filterLocation
            ? {
                OR: [
                    { deliverySupplierId: filterLocation },
                    { pickupSupplierId: filterLocation },
                ],
            }
            : {}),
            status: STATUS.OPEN, 
            requesterId: { 
                not: courierId
            }
        }
    });

    if (!orders) {
        throw new AppError("No records found for this page", 400);
    }

    return {
        orders,
        pagination: {
            limit: LIMIT,
            page: page,
            totalCount: totalCount,
            totalPages: Math.ceil(totalCount / LIMIT),
        }
    };
}

export async function acceptOpenOrder(courierId: string, orderId: string) {
    // ensure that the status of orders are updated
    await updateExpiredOrders();

    const oldStatus: OrderStatus = STATUS.OPEN;
    const newStatus: OrderStatus = STATUS.ACCEPTED;

    const now: Date = new Date();
    const order = await prisma.order.findUnique({
        where: {
            id: orderId,
        }
    });

    // order id does not exist
    if (!order) {
        throw new AppError(`Order ${orderId} does not exist`, 404);
    }

    // order has expired
    if (order.expiryAt <= now || order.status === STATUS.EXPIRED) {
        if (order.status === STATUS.OPEN) {
            await updateExpiredOrders(); // update the row to expired, if it is still open
        }
        throw new AppError(`Order ${orderId} has expired`, 400);
    }

    // disallow action if order is no longer open (F3.1.3)
    if (order.status !== STATUS.OPEN) {
        throw new AppError(`Order ${orderId} is not in the OPEN status and cannot be accepted`, 400);
    }

    // disallow action if requester is trying to accept their own order (F3.1.1)
    if (order.requesterId === courierId) {
        throw new AppError(`Requester ${courierId} cannot accept their own order ${orderId}`, 403);
    }

    const result = await prisma.$transaction(async (tx) => {
        // update order status to ACCEPTED (F3.2.1); updatedAt column is automatically updated by Prisma (F3.2.2)
        const updatedOrder = await tx.order.update({
            where: {
                id: order.id,
            }, 
            data: {
                courierId: courierId,
                status: newStatus,
                version: order.version + 1,
                acceptedAt: now // record time when order was accepted (F3.2.2)
            }
        });

         // check if update was successful
        if (!updatedOrder || updatedOrder.status != newStatus) {
            throw new AppError(`Status update for order ${order.id} has failed`, 500);
        }

        // update the order status history
        const transactionRecord = await tx.orderStatusHistory.create({
            data: {
                orderId: updatedOrder.id,
                fromStatus: STATUS.ACCEPTED,
                toStatus: newStatus, 
                changedBy: courierId
            }
        });

        // check if transaction record was successfully logged
        if (!transactionRecord) {
            throw new AppError(`Unable to record status update for order ${updatedOrder.id}`, 500);
        }

        return updatedOrder;
    });

    return result;
}

export async function pickUpAcceptedOrder(courierId: string, orderId: string) {
    const oldStatus: OrderStatus = STATUS.ACCEPTED;
    const newStatus: OrderStatus = STATUS.PICKED_UP;

    const now: Date = new Date();

    const order = await prisma.order.findUnique({
        where: {
            id: orderId,
        }
    });

    // order id does not exist
    if (!order) {
        throw new AppError(`Order ${orderId} does not exist`, 404);
    }

    // check that the user trying to mark the order as PICKED_UP is listed as the courier of the order (F4.1.1)
    if (order.courierId !== courierId) {
        throw new AppError(`Courier ${courierId} is not assigned to order ${orderId}`, 403);
    }

    // check that order is still in the ACCEPTED status (F4.1.2)
    if (order.status !== STATUS.ACCEPTED) {
        throw new AppError(`Order ${orderId} is not in the ACCEPTED status and cannot be marked as picked up`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
        // update order status to PICKED_UP (F4.2); updatedAt column is automatically updated by Prisma (F4.2.1)
        const updatedOrder = await tx.order.update({
            where: {
                id: order.id,
            }, 
            data: {
                status: newStatus,
                version: order.version + 1,
                pickedUpAt: now // record time when order was accepted (F4.2.1)
            }
        });

         // check if update was successful
        if (!updatedOrder || updatedOrder.status != newStatus) {
            throw new AppError(`Status update for order ${order.id} has failed`, 500);
        }

        // update the order status history
        const transactionRecord = await tx.orderStatusHistory.create({
            data: {
                orderId: updatedOrder.id,
                fromStatus: oldStatus,
                toStatus: newStatus, 
                changedBy: courierId
            }
        });

        // check if transaction record was successfully logged
        if (!transactionRecord) {
            throw new AppError(`Unable to record status update for order ${updatedOrder.id}`, 500);
        }

        return updatedOrder;
    });

    return result;
}

export async function completePickedUpOrder(courierId: string, orderId: string) {
    const oldStatus: OrderStatus = STATUS.PICKED_UP;
    const newStatus: OrderStatus = STATUS.COMPLETED;

    const now: Date = new Date();

    const order = await prisma.order.findUnique({
        where: {
            id: orderId,
        }
    });

    // order id does not exist
    if (!order) {
        throw new AppError(`Order ${orderId} does not exist`, 404);
    }

    // check that the user trying to mark the order as COMPLETED is listed as the courier of the order (F5.1.1)
    if (order.courierId !== courierId) {
        throw new AppError(`Courier ${courierId} is not assigned to order ${orderId}`, 403);
    }

    // check that order is still in the PICKED_UP status (F5.1.2)
    if (order.status !== STATUS.PICKED_UP) {
        throw new AppError(`Order ${orderId} cannot be marked as picked up`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
        // update order status to PICKED_UP (F5.2); updatedAt column is automatically updated by Prisma (F5.2.1)
        const updatedOrder = await tx.order.update({
            where: {
                id: order.id,
            }, 
            data: {
                status: newStatus,
                version: order.version + 1,
                completedAt: now // record time when order was accepted (F5.2.1)
            }
        });

         // check if update was successful
        if (!updatedOrder || updatedOrder.status != newStatus) {
            throw new AppError(`Status update for order ${order.id} has failed`, 500);
        }

        // update the order status history
        const transactionRecord = await tx.orderStatusHistory.create({
            data: {
                orderId: updatedOrder.id,
                fromStatus: oldStatus,
                toStatus: newStatus, 
                changedBy: courierId
            }
        });

        // check if transaction record was successfully logged
        if (!transactionRecord) {
            throw new AppError(`Unable to record status update for order ${updatedOrder.id}`, 500);
        }

        return updatedOrder;
    });

    return result;
}

export async function dropAcceptedOrder(courierId: string, orderId: string) {
    const oldStatus: OrderStatus = STATUS.ACCEPTED;
    const newStatus: OrderStatus = STATUS.OPEN;

    const order = await prisma.order.findUnique({
        where: {
            id: orderId,
        }
    });

    // order id does not exist
    if (!order) {
        throw new AppError(`Order ${orderId} does not exist`, 404);
    }

    // check that the user trying to drop the order is listed as the courier of the order 
    if (order.courierId !== courierId) {
        throw new AppError(`Courier ${courierId} is not assigned to order ${orderId}`, 403);
    }

    // check that order is still in the ACCEPTED status (F7.1.1)
    if (order.status !== STATUS.ACCEPTED) {
        throw new AppError(`Order ${orderId} is not in the ACCEPTED status and cannot be marked as picked up`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
        // update order status to OPEN (F7.2)
        const updatedOrder = await tx.order.update({
            where: {
                id: order.id,
            }, 
            data: {
                courierId: null, // remove courier (F7.2)
                status: newStatus, // change to OPEN status (F7.2.1)
                version: order.version + 1,
                acceptedAt: null, // reset acceptedAt timestamp
            }
        });

         // check if update was successful
        if (!updatedOrder || updatedOrder.status != newStatus) {
            throw new AppError(`Status update for order ${order.id} has failed`, 500);
        }

        // update the order status history
        const transactionRecord = await tx.orderStatusHistory.create({
            data: {
                orderId: updatedOrder.id,
                fromStatus: oldStatus,
                toStatus: newStatus, 
                changedBy: courierId
            }
        });

        // check if transaction record was successfully logged
        if (!transactionRecord) {
            throw new AppError(`Unable to record status update for order ${updatedOrder.id}`, 500);
        }

        return updatedOrder;
    });

    return result;
}

export async function getCourierAcceptanceHistory(courierId: string, input: GetCourierOrderHistoryInput) {
    const page: number = input.page;
    const sortBy: string = input.sortBy; // default set to sorting by accepted time
    const sortOrder = input.sortOrder; // default set to sorting in ascending order (earliest to latest)
    const status: OrderStatus | undefined = input.status; 

    const orders = await prisma.order.findMany({
        where: { 
            courierId: courierId, // enforce full string match
            ...(status ? { status: status } : {}), // If status is provided, include it in the where clause; otherwise, don't filter by status 
        }, 
        orderBy: { [sortBy]: sortOrder }, 
        take: LIMIT, 
        skip: LIMIT * (page - 1),
    });

    const totalCount = await prisma.order.count({
        where: { 
            courierId: courierId, // enforce full string match
            ...(status ? { status: status } : {}), // If status is provided, include it in the where clause; otherwise, don't filter by status 
        }
    });

    if (!orders) {
        throw new AppError(`No records found for page ${page}`, 400);
    }

    return {
        orders,
        pagination: {
            limit: LIMIT,
            page: page,
            totalCount: totalCount,
            totalPages: Math.ceil(totalCount / LIMIT),
        }
    };
}
