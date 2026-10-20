import { creditTransaction } from "../libs/credit-transaction.js";
import { AppError } from "../errors/errors.js";
import { type AbortReservationInput, type RenewReservationInput, type ReservationInput } from "../schemas/reservation.schema.js";
import { prisma } from "../libs/prisma.js";
import { Prisma, ReservationStatus, SettlementReason } from "../generated/prisma/client.js";

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

function validateRenewalReplay(
    reservation: {
        orderId: string;
        requesterId: string;
        amount: number;
        previousReservationId: string | null;
    },
    input: RenewReservationInput,
) {
    // A renewal key can only be used once, and the details of the reservation must match the previous attempt.
    if (
        reservation.orderId !== input.orderId ||
        reservation.requesterId !== input.requesterId ||
        reservation.amount !== input.amount ||
        reservation.previousReservationId !== input.previousReservationId
    ) {
        throw new AppError("Renewal key was reused with different reservation details", 409);
    }
}

export async function renewReservation(input: RenewReservationInput) {
    try {
        return await creditTransaction(prisma, async tx => {
            // Check if the renewal key has been used before
            const previousAttempt = await tx.creditReservation.findUnique({
                where: { renewalKey: input.renewalKey }
            });

            if (previousAttempt) {
                // Make sure the renewal key wasn't reused with different reservation details
                validateRenewalReplay(previousAttempt, input);
                return { reservation: previousAttempt, created: false };
            }

            // Load the reservation that expired and is being renewed
            const previousReservation = await tx.creditReservation.findUnique({
                where: { id: input.previousReservationId }
            });

            // The previous reservation must exist for the renewal to proceed
            if (!previousReservation) {
                throw new AppError("Previous reservation not found", 404);
            }

            // Ensure that the previous reservation matches the renewal input
            if (previousReservation.orderId !== input.orderId ||
                previousReservation.requesterId !== input.requesterId ||
                previousReservation.amount !== input.amount
            ) {
                throw new AppError("Previous reservation details do not match the renewal input", 409);
            }

            // Renewal can only be done on reservations that have expired
            if (previousReservation.status !== ReservationStatus.RELEASED ||
                previousReservation.settlementReason !== SettlementReason.EXPIRED
            ) {
                throw new AppError("Only expired reservations can be renewed", 409);
            }

            const account = await tx.creditAccount.findUnique({
                where: { userId: input.requesterId }
            });
            if (!account) throw new AppError("Credit account not found", 404);

            if (previousReservation.accountId !== account.id) {
                throw new AppError("Previous reservation account is inconsistent", 409);
            }

            // Do not allow two active reservations for the same order
            const activeReservation = await tx.creditReservation.findFirst({
                where: {
                    orderId: input.orderId,
                    status: ReservationStatus.RESERVED,
                }
            });

            if (activeReservation) {
                throw new AppError("An active reservation already exists for this order", 409);
            }

            // Create a new reservation with the same details as the previous one, but with a new ID and the renewal key
            const newReservation = await tx.creditReservation.create({
                data: {
                    orderId: input.orderId,
                    requesterId: input.requesterId,
                    amount: input.amount,
                    accountId: account.id,
                    renewalKey: input.renewalKey,
                    previousReservationId: input.previousReservationId,
                }
            });

            // Update the account's available and reserved credits
            const updated = await tx.creditAccount.updateMany({
                where: {
                    id: account.id,
                    availableCredits: { gte: input.amount },
                    reservedCredits: { lte: 2_147_483_647 - input.amount }
                },
                data: {
                    availableCredits: { decrement: input.amount },
                    reservedCredits: { increment: input.amount }
                },
            });

            if (updated.count !== 1) {
                throw new AppError("Rserved balance is inconsistent or available balance would overflow", 409);
            }

            // Record the transaction for the new reservation
            await tx.creditTransaction.create({
                data: {
                    accountId: account.id, reservationId: newReservation.id, orderId: input.orderId,
                    type: "RESERVATION", amount: input.amount, availableDelta: -input.amount, reservedDelta: input.amount,
                    idempotencyKey: `${newReservation.id}:RESERVATION:${account.id}`,
                }
            });
            return { reservation: newReservation, created: true };
        });
    } catch (error) {
        // Another process may have created a reservation with the same renewal key concurrently. 
        // Check if the renewal key has been used before and validate that the details match the previous attempt.
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            const existingReservation = await prisma.creditReservation.findUnique({
                where: { renewalKey: input.renewalKey }
            });

            if (existingReservation) {
                validateRenewalReplay(existingReservation, input);
                return { reservation: existingReservation, created: false };
            }

            throw new AppError("Order already has an active reservation", 409);
        }

        throw error;
    }
}