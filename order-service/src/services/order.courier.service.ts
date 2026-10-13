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
