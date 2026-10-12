import type { ApiUser } from "@/features/auth/types/auth.types";
import type { CreditTransaction, CreditTransactions } from "@/features/credit/types/credit.types";

export const student: ApiUser = {
    id: "00000000-0000-4000-8000-000000000010",
    role: "STUDENT",
    email: "student@example.test",
    username: "Student",
    phoneNumber: "12345678",
};

export const initialTransaction: CreditTransaction = {
    id: "00000000-0000-4000-8000-000000000001",
    type: "INITIAL_ALLOCATION",
    amount: 50,
    availableDelta: 50,
    reservedDelta: 0,
    createdAt: "2026-10-12T00:00:00.000Z",
    orderId: null,
};

export const readyHistory = (
    items: CreditTransaction[] = [initialTransaction], nextCursor: string | null = null,
): CreditTransactions => ({ status: "READY", items, nextCursor });

export function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
