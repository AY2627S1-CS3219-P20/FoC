import { z } from "zod";
import {
    CreditTransactionType,
    Prisma,
    type CreditAccount,
    type CreditTransaction,
    type PrismaClient,
} from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import type { BalanceResponse, TransactionsResponse } from "../types/credit.types.js";
import type { TransactionQuery } from "../schemas/credit.schema.js";
import { decodeTransactionCursor, encodeTransactionCursor } from "../libs/credit-cursor.js";

/** Read current balances without provisioning or changing the account. */
export async function getCreditBalance(
    prisma: PrismaClient,
    userId: string,
): Promise<BalanceResponse["data"]> {
    const account = await prisma.creditAccount.findUnique({
        where: { userId },
        select: { availableCredits: true, reservedCredits: true, updatedAt: true },
    });

    if (!account) return { status: "PROVISIONING" };

    return {
        status: "READY",
        availableCredits: account.availableCredits,
        reservedCredits: account.reservedCredits,
        updatedAt: account.updatedAt.toISOString(),
    };
}

/** Read an account-scoped ledger page; never provision an absent account. */
export async function getCreditTransactions(
    prisma: PrismaClient,
    userId: string,
    query: TransactionQuery,
): Promise<TransactionsResponse["data"]> {
    // Reject malformed tokens even when the account is not provisioned yet.
    const cursor = query.cursor === undefined ? undefined : decodeTransactionCursor(query.cursor);
    const account = await prisma.creditAccount.findUnique({
        where: { userId },
        select: { id: true },
    });
    if (!account) return { status: "PROVISIONING" };

    const where: Prisma.CreditTransactionWhereInput = {
        accountId: account.id,
        ...(query.type === undefined ? {} : { type: query.type }),
    };

    if (cursor) {
        if (cursor.accountId !== account.id || cursor.type !== (query.type ?? null) || cursor.sort !== query.sort) {
            throw new AppError("Invalid cursor", 400);
        }
        const anchor = await prisma.creditTransaction.findFirst({
            where: { ...where, id: cursor.transactionId },
            select: { id: true },
        });
        if (!anchor) throw new AppError("Invalid cursor", 400);
    }

    const rows = await prisma.creditTransaction.findMany({
        where,
        orderBy: [{ createdAt: query.sort }, { id: query.sort }],
        take: query.limit + 1,
        // Prisma resolves the anchor's ordering values in PostgreSQL, preserving
        // microseconds that would be lost by using a JavaScript Date boundary.
        ...(cursor ? { cursor: { id: cursor.transactionId }, skip: 1 } : {}),
        select: {
            id: true,
            type: true,
            amount: true,
            availableDelta: true,
            reservedDelta: true,
            createdAt: true,
            orderId: true,
        },
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const nextCursor = rows.length > query.limit && last
        ? encodeTransactionCursor({
            version: 1,
            accountId: account.id,
            type: query.type ?? null,
            sort: query.sort,
            transactionId: last.id,
        })
        : null;

    return {
        status: "READY",
        items: page.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
        nextCursor,
    };
}

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
