import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import { OrderEventType, OrderStatus } from "../generated/prisma/client.js";
import { randomUUID } from "node:crypto";

// order lifecycle statuses
const STATUS = OrderStatus;

// expiryAt is the deadline for a courier to accept the request.

// This function finds all orders that have not been ACCEPTED by a courier,
// and checks if the current time is past the expiry time for all orders that are expired. 
// If an order is expired, it updates the order's status to EXPIRED, logs the status change, and creates an outbox event.
export async function updateExpiredOrders() {
    const now: Date = new Date();
    console.log(`Checking for expired orders at ${now.toISOString()}`);

    // update database
    const result = await prisma.$transaction(async (tx) => {
        // update rows in the Order table
        const ordersUpdated = await tx.order.updateManyAndReturn({
            where: {
                status: STATUS.OPEN, // only update orders that are still open
                courierId: null, // only update orders that have not been accepted by a courier
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
                    changedBy: null, // indicate system update with null
                    reason: "Request expired due to no courier acceptance before expiryAt timestamp"
                }
            });
            // check if transaction record was successfully logged
            if (!transactionRecord) {
                throw new AppError(`Unable to record status update for order ${order.id}`, 500);
            }

            // check if the order has a credit reservation ID before attempting to release credits
            if (!order.creditReservationId) {
                throw new AppError(
                    `Expired order ${order.id} has no credit reservation`,
                    409,
                );
            }

            const eventId = randomUUID();
            await tx.outboxEvent.create({
                data: {
                    id: eventId,
                    orderId: order.id,
                    eventType: OrderEventType.ORDER_EXPIRED,
                    payload: {
                        eventId: eventId,
                        eventType: OrderEventType.ORDER_EXPIRED,
                        reservationId: order.creditReservationId,
                        orderId: order.id,
                        requesterId: order.requesterId,
                        amount: order.offeredCredits,
                    }
                }
            });
        }

        return ordersUpdated;
    });

    return result.length;
}
