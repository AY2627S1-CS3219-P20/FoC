import { creditTransaction } from "../libs/credit-transaction.js";
import { AppError } from "../errors/errors.js";
import { type AbortReservationInput, type ReservationInput } from "../schemas/reservation.schema.js";
import { prisma } from "../libs/prisma.js";

export async function reserveCredits(input: ReservationInput) {
    const { orderId, requesterId, amount } = input;
    return creditTransaction(prisma, async tx => {
        const account = await tx.creditAccount.findUnique({ where: { userId: requesterId } });
        if (!account) throw new AppError("Credit account not found", 404);
        const reservation = await tx.creditReservation.create({
            data: {
                orderId, requesterId, amount, accountId: account.id,
            }
        });
        const updated = await tx.creditAccount.updateMany({
            where: { id: account.id, availableCredits: { gte: amount }, reservedCredits: { lte: 2_147_483_647 - amount } },
            data: { availableCredits: { decrement: amount }, reservedCredits: { increment: amount } },
        });
        if (updated.count !== 1) throw new AppError("Insufficient available credits or reserved balance would overflow", 409);
        await tx.creditTransaction.create({
            data: {
                accountId: account.id, reservationId: reservation.id, orderId,
                type: "RESERVATION", amount, availableDelta: -amount, reservedDelta: amount,
                idempotencyKey: `${reservation.id}:RESERVATION:${account.id}`,
            }
        });
        return { reservation, created: true };
    });
}

export async function abortReservation(input: AbortReservationInput) {
    const { reservationId, orderId, requesterId, amount } = input;
    return creditTransaction(prisma, async tx => {
        const existing = await tx.creditReservation.findUnique({ where: { id: reservationId } });
        if (!existing) throw new AppError("Reservation not found", 404);
        if (existing.orderId !== orderId || existing.requesterId !== requesterId || existing.amount !== amount) {
            throw new AppError("Reservation identifiers or amount do not match", 409);
        }
        if (existing.status === "ABORTED") return { reservation: existing, created: false };
        if (existing.status !== "RESERVED") throw new AppError("Settled reservation cannot be aborted", 409);
        const account = await tx.creditAccount.findUnique({ where: { userId: requesterId } });
        if (!account || account.id !== existing.accountId) throw new AppError("Reservation account is inconsistent", 409);
        const updated = await tx.creditAccount.updateMany({
            where: { id: account.id, reservedCredits: { gte: amount }, availableCredits: { lte: 2_147_483_647 - amount } },
            data: { availableCredits: { increment: amount }, reservedCredits: { decrement: amount } },
        });
        if (updated.count !== 1) throw new AppError("Reserved balance is inconsistent or available balance would overflow", 409);
        const reservation = await tx.creditReservation.update({
            where: { id: existing.id },
            data: { status: "ABORTED", settlementReason: "CREATION_ABORTED", settledAt: new Date() },
        });
        await tx.creditTransaction.create({
            data: {
                accountId: account.id, reservationId: reservation.id, orderId,
                type: "RELEASE", amount, availableDelta: amount, reservedDelta: -amount,
                idempotencyKey: `${reservation.id}:RELEASE:${account.id}`,
            }
        });
        return { reservation, created: false };
    });
}

export async function getReservation(reservationId: string) {
    return creditTransaction(prisma, async tx => {
        const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
        if (!reservation) throw new AppError("Reservation not found", 404);
        return reservation;
    });
}
