import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import type { GetOpenOrdersInput } from "../schemas/order.courier.schema.js";
import { OrderStatus } from "../generated/prisma/client.js";

// order lifecycle statuses
const STATUS = OrderStatus;

// page limit (max 15 orders per page)
const LIMIT: number = 15;

// lazy update
export async function updateExpiredOrders() {
    // this function finds all orders of the OPEN status, and checks if the current time is past the expiry time
    // for all orders that are expired, perform a prisma transaction to update the status
    const now: Date = new Date();
    console.log(now);
    // update database
    const result = await prisma.$transaction(async (tx) => {
        // update rows in the Order table
        const ordersUpdated = await prisma.order.updateManyAndReturn({
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
    // const filterBy: string = input.filterBy ?? "";
    // const filterLocations: string[] = input.filterLocations ?? [];
    const searchString: string = input.searchString ?? "";

    // ensure that the status of orders are updated
    await updateExpiredOrders();
    
    const orders = await prisma.order.findMany({
        where: { 
            name: {
                contains: searchString, // enforce partial string match
                mode: 'insensitive', // enforce case insensitivity
            }, 
            status: STATUS.OPEN, 
            requesterId: { 
                not: courierId
            }
        },
        orderBy: { [sortBy]: sortOrder }, 
        take: LIMIT, 
        skip: LIMIT * (page - 1),
    });

    if (!orders || orders.length == 0) {
        throw new AppError("No records found for this page", 400);
    }

    return orders;
}

export async function acceptOpenOrder(courierId: string, orderId: string) {
    // ensure that the status of orders are updated
    await updateExpiredOrders();

    const oldStatus: OrderStatus = STATUS.OPEN;
    const newStatus: OrderStatus = STATUS.ACCEPTED;

    const result = await prisma.$transaction(async (tx) => {
        // check if the order exists, is still open (F3.1.3) and requester is not trying to accept their own order (F3.1.1)
        const now: Date = new Date();
        const order = await tx.order.findUnique({
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

        // order is no longer open
        if (order.status !== STATUS.OPEN) {
            throw new AppError(`Order ${orderId} cannot be accepted`, 400);
        }

        // requester is trying to accept their own order
        if (order.requesterId === courierId) {
            throw new AppError(`Requester ${courierId} cannot accept their own order ${orderId}`, 403);
        }

        // update order status to ACCEPTED (F3.2.1); updatedAt column is automatically updated by Prisma (F4.2.1)
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
