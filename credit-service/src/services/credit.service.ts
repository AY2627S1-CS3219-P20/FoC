import { z } from "zod";
import {
    CreditTransactionType,
    Prisma,
    type CreditAccount,
    type CreditTransaction,
    type PrismaClient,
} from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";

const INITIAL_CREDITS = 50;
const userIdSchema = z.uuid().transform((value) => value.toLowerCase());

export interface InitialCreditGrantResult {
    account: CreditAccount;
    transaction: CreditTransaction;
    created: boolean;
}

/**
 * Provision a verified student's initial credits. The caller owns eligibility
 * checks; this internal function does not query user-service or expose an API.
 * Duplicate calls return the original grant and current balances unchanged.
 */
export async function grantInitialCredits(
    prisma: PrismaClient,
    userId: string,
): Promise<InitialCreditGrantResult> {
    const parsedUserId = userIdSchema.safeParse(userId);
    if (!parsedUserId.success) {
        throw new AppError("userId must be a valid UUID", 400, "INVALID_USER_ID");
    }

    const normalizedUserId = parsedUserId.data;
    const idempotencyKey = `initial-allocation:${normalizedUserId}`;

    // Only a conflict during account creation can represent a duplicate call.
    // Failures writing the ledger must always propagate after rollback.
    let accountCreated = false;
    try {
        return await prisma.$transaction(async (tx) => {
            const account = await tx.creditAccount.create({
                data: {
                    userId: normalizedUserId,
                    availableCredits: INITIAL_CREDITS,
                    reservedCredits: 0,
                },
            });
            accountCreated = true;

            const transaction = await tx.creditTransaction.create({
                data: {
                    accountId: account.id,
                    type: CreditTransactionType.INITIAL_ALLOCATION,
                    amount: INITIAL_CREDITS,
                    availableDelta: INITIAL_CREDITS,
                    reservedDelta: 0,
                    orderId: null,
                    idempotencyKey,
                },
            });

            return { account, transaction, created: true };
        });
    } catch (error) {
        if (
            accountCreated ||
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== "P2002"
        ) {
            throw error;
        }

        // The failed transaction has rolled back. A concurrent winner's account
        // and grant are now committed together; never query the aborted tx.
        const existing = await prisma.creditAccount.findUnique({
            where: { userId: normalizedUserId },
            include: {
                transactions: {
                    where: { type: CreditTransactionType.INITIAL_ALLOCATION },
                },
            },
        });

        // An unrelated uniqueness failure is not successful provisioning.
        if (!existing) {
            throw error;
        }

        const { transactions, ...account } = existing;
        const transaction = transactions[0];
        if (
            transactions.length !== 1 ||
            !transaction ||
            transaction.idempotencyKey !== idempotencyKey ||
            transaction.amount !== INITIAL_CREDITS ||
            transaction.availableDelta !== INITIAL_CREDITS ||
            transaction.reservedDelta !== 0 ||
            transaction.orderId !== null
        ) {
            throw new AppError(
                "Credit account exists without a valid initial allocation; investigation is required",
                500,
                "CREDIT_ACCOUNT_INCONSISTENT",
            );
        }

        return { account, transaction, created: false };
    }
}
