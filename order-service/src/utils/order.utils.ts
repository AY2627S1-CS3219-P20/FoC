import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import { OrderStatus } from "../generated/prisma/client.js";

// order lifecycle statuses
const STATUS = OrderStatus;

export async function updateExpiredOrders() {
    // this function finds all orders that have not yet advanced to the RECEIVED status, and checks if the current time is past the 
    // expiry time for all orders that are expired, perform a prisma transaction to update the status (F8.1.1)
    const now: Date = new Date();
    console.log(now);
    // update database
    const result = await prisma.$transaction(async (tx) => {
        // update rows in the Order table
        const ordersUpdated = await tx.order.updateManyAndReturn({
            where: {
                status: { notIn: [STATUS.RECEIVED, STATUS.CANCELED, STATUS.FAILED, STATUS.EXPIRED] },
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
