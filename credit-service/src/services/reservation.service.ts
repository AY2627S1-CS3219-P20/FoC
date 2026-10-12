import { Prisma, type PrismaClient, type CreditReservation } from "../generated/prisma/client.js";
import { creditTransaction } from "../libs/credit-transaction.js";
import { AppError } from "../errors/errors.js";
import { reservationSchema, reservationIdSchema, type ReservationInput } from "../schemas/reservation.schema.js";

function validate(input: unknown): ReservationInput {
    const parsed = reservationSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid reservation", 400);
    return parsed.data;
}

function checkReplay(reservation: CreditReservation, input: ReservationInput) {
    if (reservation.orderId !== input.orderId || reservation.requesterId !== input.requesterId || reservation.amount !== input.amount) {
        throw new AppError("Reservation identifiers or amount do not match", 409);
    }
}

async function mutate(prisma: PrismaClient, input: ReservationInput, abort: boolean): Promise<{ reservation: CreditReservation; created: boolean }> {
    let insertingReservation = false;
    try {
        return await creditTransaction(prisma, async tx => {
            insertingReservation = false;
            const existing = await tx.creditReservation.findUnique({ where: { id: input.reservationId } });
            if (existing) {
                checkReplay(existing, input);
                if (!abort || existing.status === "ABORTED") return { reservation: existing, created: false };
                if (existing.status !== "RESERVED") throw new AppError("Settled reservation cannot be aborted", 409);
                const account = await tx.creditAccount.findUnique({ where: { userId: input.requesterId } });
                if (!account || account.id !== existing.accountId) throw new AppError("Reservation account is inconsistent", 409);
                const updated = await tx.creditAccount.updateMany({
                    where: { id: account.id, reservedCredits: { gte: input.amount } },
                    data: { availableCredits: { increment: input.amount }, reservedCredits: { decrement: input.amount } },
                });
                if (updated.count !== 1) throw new AppError("Reserved balance is inconsistent", 409);
                const reservation = await tx.creditReservation.update({
                    where: { id: existing.id },
                    data: { status: "ABORTED", settlementReason: "CREATION_ABORTED", settledAt: new Date() },
                });
                await tx.creditTransaction.create({ data: {
                    accountId: account.id, reservationId: reservation.id, orderId: input.orderId,
                    type: "RELEASE", amount: input.amount, availableDelta: input.amount, reservedDelta: -input.amount,
                    idempotencyKey: `${reservation.id}:RELEASE:${account.id}`,
                } });
                return { reservation, created: false };
            }
            if (abort) {
                insertingReservation = true;
                const reservation = await tx.creditReservation.create({ data: {
                    id: input.reservationId, orderId: input.orderId, requesterId: input.requesterId, amount: input.amount,
                    status: "ABORTED", settlementReason: "CREATION_ABORTED", settledAt: new Date(),
                } });
                insertingReservation = false;
                return { reservation, created: true };
            }
            const account = await tx.creditAccount.findUnique({ where: { userId: input.requesterId } });
            if (!account) throw new AppError("Credit account not found", 404);
            const active = await tx.creditReservation.findFirst({ where: { orderId: input.orderId, status: "RESERVED" } });
            if (active) throw new AppError("Order already has an active reservation", 409);
            insertingReservation = true;
            const reservation = await tx.creditReservation.create({ data: {
                id: input.reservationId, orderId: input.orderId, requesterId: input.requesterId,
                amount: input.amount, accountId: account.id,
            } });
            insertingReservation = false;
            const updated = await tx.creditAccount.updateMany({
                where: { id: account.id, availableCredits: { gte: input.amount } },
                data: { availableCredits: { decrement: input.amount }, reservedCredits: { increment: input.amount } },
            });
            if (updated.count !== 1) throw new AppError("Insufficient available credits", 409);
            await tx.creditTransaction.create({ data: {
                accountId: account.id, reservationId: reservation.id, orderId: input.orderId,
                type: "RESERVATION", amount: input.amount, availableDelta: -input.amount, reservedDelta: input.amount,
                idempotencyKey: `${reservation.id}:RESERVATION:${account.id}`,
            } });
            return { reservation, created: true };
        });
    } catch (error) {
        if (!insertingReservation || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        // Resolve reservation/order uniqueness races only after the failed transaction rolls back.
        return creditTransaction(prisma, async tx => {
            const existing = await tx.creditReservation.findUnique({ where: { id: input.reservationId } });
            if (existing) {
                checkReplay(existing, input);
                // Abort must still release a concurrently committed hold.
                if (abort && existing.status === "RESERVED") return null;
                if (abort && existing.status !== "ABORTED") throw new AppError("Settled reservation cannot be aborted", 409);
                return { reservation: existing, created: false };
            }
            const active = await tx.creditReservation.findFirst({ where: { orderId: input.orderId, status: "RESERVED" } });
            if (active) throw new AppError("Order already has an active reservation", 409);
            throw error;
        }).then(result => result ?? mutate(prisma, input, abort));
    }
}

export async function reserveCredits(prisma: PrismaClient, input: unknown) {
    return mutate(prisma, validate(input), false);
}
export async function abortReservation(prisma: PrismaClient, input: unknown) {
    return mutate(prisma, validate(input), true);
}
export async function getReservation(prisma: PrismaClient, id: unknown) {
    const parsed = reservationIdSchema.safeParse(id);
    if (!parsed.success) throw new AppError("Invalid reservation ID", 400);
    return creditTransaction(prisma, async tx => {
        const reservation = await tx.creditReservation.findUnique({ where: { id: parsed.data } });
        if (!reservation) throw new AppError("Reservation not found", 404);
        return reservation;
    });
}
