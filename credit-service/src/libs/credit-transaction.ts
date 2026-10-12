import { setTimeout as delay } from "node:timers/promises";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";

export function isTemporaryDatabaseError(error: unknown): boolean {
    const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
    const root = record(error);
    const adapter = record(record(root.meta).driverAdapterError);
    const codes = ["P1001", "P1002", "P1008", "P1017", "P2024", "P2037", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "53300", "57014", "57P01", "57P02", "57P03"];
    return [root, record(root.cause), adapter, record(adapter.cause)].some(value => {
        const code = value.code ?? value.errorCode ?? value.originalCode;
        return (typeof code === "string" && (codes.includes(code) || /^08[0-9A-Z]{3}$/.test(code)))
            || ["DatabaseNotReachable", "ConnectionClosed", "SocketTimeout", "TooManyConnections"].includes(String(value.kind))
            || ["timeout exceeded when trying to connect", "Connection terminated due to connection timeout", "Connection terminated", "Connection terminated unexpectedly", "Query read timeout"].includes(String(value.message));
    });
}

export async function creditTransaction<T>(prisma: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
                if (isTemporaryDatabaseError(error)) {
                    const unavailable = new AppError("Credit database temporarily unavailable", 503, "SERVICE_UNAVAILABLE");
                    unavailable.cause = error;
                    throw unavailable;
                }
                throw error;
            }
            if (attempt === 2) throw new AppError("Credit database busy; retry the same operation", 503, "SERVICE_UNAVAILABLE");
            await delay(10 + Math.random() * 20);
        }
    }
}

