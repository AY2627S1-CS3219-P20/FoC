import { isDeepStrictEqual } from "node:util";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import { creditTransaction } from "../libs/credit-transaction.js";
import { settlementEventSchema } from "../schemas/settlement-event.schema.js";

export async function transferCredits(prisma: PrismaClient, input: unknown) {
    const parsed = settlementEventSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid settlement event", 400);
    const event = parsed.data;
    if (event.requesterId === event.courierId) throw new AppError("Requester cannot receive their own transfer", 409);
    try {
        return await creditTransaction(prisma, async tx => {
            const reservation = await tx.creditReservation.findUnique({ where: { id: event.reservationId } });
            if (!reservation) throw new AppError("Reservation not found", 404);
            if (reservation.orderId !== event.orderId || reservation.requesterId !== event.requesterId || reservation.amount !== event.amount) {
                throw new AppError("Settlement identifiers or amount do not match", 409);
            }
            if (reservation.status !== "RESERVED") {
                if (reservation.status === "TRANSFERRED" && reservation.settlementEventId === event.eventId
                    && reservation.settlementReason === "RECEIVED" && reservation.courierId === event.courierId
                    && isDeepStrictEqual(reservation.settlementPayload, event)) return { reservation, transferred: false };
                throw new AppError("Reservation already has a different terminal outcome", 409);
            }
            const requester = await tx.creditAccount.findUnique({ where: { userId: event.requesterId } });
            const courier = await tx.creditAccount.findUnique({ where: { userId: event.courierId } });
            if (!requester || !courier) throw new AppError("Settlement account not found", 404);
            if (requester.id !== reservation.accountId) throw new AppError("Reservation account is inconsistent", 409);
            const claimed = await tx.creditReservation.updateMany({
                where: { id: reservation.id, status: "RESERVED" },
                data: { status: "TRANSFERRED", courierId: event.courierId, settlementEventId: event.eventId,
                    settlementReason: "RECEIVED", settlementPayload: event, settledAt: new Date() },
            });
            if (claimed.count !== 1) throw new AppError("Reservation already settled", 409);
            const debited = await tx.creditAccount.updateMany({
                where: { id: requester.id, reservedCredits: { gte: reservation.amount } },
                data: { reservedCredits: { decrement: reservation.amount } },
            });
            if (debited.count !== 1) throw new AppError("Reserved balance is inconsistent", 409);
            const credited = await tx.creditAccount.updateMany({
                where: { id: courier.id, availableCredits: { lte: 2_147_483_647 - reservation.amount } },
                data: { availableCredits: { increment: reservation.amount } },
            });
            if (credited.count !== 1) throw new AppError("Courier balance would overflow", 409);
            await tx.creditTransaction.createMany({ data: [
                { accountId: requester.id, type: "TRANSFER_SENT" as const, availableDelta: 0, reservedDelta: -reservation.amount },
                { accountId: courier.id, type: "TRANSFER_RECEIVED" as const, availableDelta: reservation.amount, reservedDelta: 0 },
            ].map(row => ({ ...row, amount: reservation.amount, orderId: reservation.orderId, reservationId: reservation.id,
                idempotencyKey: `${reservation.id}:${row.type}:${row.accountId}` })) });
            return { reservation: await tx.creditReservation.findUniqueOrThrow({ where: { id: reservation.id } }), transferred: true };
        });
    } catch (error) {
        // A reused event ID or ledger key is a conflict, never a successful replay.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new AppError("Settlement event or ledger identity already used", 409);
        }
        throw error;
    }
}
