import { beforeEach, describe, expect, it, vi } from "vitest";
import creditApi from "@/api/creditApi";
import { getCreditTransactionsService } from "./credit.service";
import { CREDIT_TRANSACTION_TYPES } from "../types/credit.types";

vi.mock("@/api/creditApi", () => ({ default: { get: vi.fn() } }));

const transaction = {
    id: "00000000-0000-4000-8000-000000000001",
    type: "INITIAL_ALLOCATION",
    amount: 50,
    availableDelta: 50,
    reservedDelta: 0,
    createdAt: "2026-10-12T00:00:00.000Z",
    orderId: null,
};
const params = { sort: "desc", limit: 20 } as const;
const respond = (data: unknown) => vi.mocked(creditApi.get).mockResolvedValue({
    data: { success: true, data },
});

beforeEach(() => { vi.mocked(creditApi.get).mockReset(); });

describe("transaction API contract", () => {
    it("omits absent filters/cursors and forwards cancellation", async () => {
        respond({ status: "READY", items: [transaction], nextCursor: "opaque-token" });
        const signal = new AbortController().signal;
        await expect(getCreditTransactionsService(params, signal)).resolves.toEqual({
            status: "READY", items: [transaction], nextCursor: "opaque-token",
        });
        expect(creditApi.get).toHaveBeenCalledWith("/credits/me/transactions", { params, signal });
    });

    it.each(CREDIT_TRANSACTION_TYPES)("accepts %s and signed balance effects", async type => {
        const item = { ...transaction, type, availableDelta: -10, reservedDelta: 10 };
        respond({ status: "READY", items: [item], nextCursor: null });
        const filtered = { ...params, sort: "asc", type, cursor: "opaque-token" } as const;
        await expect(getCreditTransactionsService(filtered)).resolves.toEqual({
            status: "READY", items: [item], nextCursor: null,
        });
        expect(creditApi.get).toHaveBeenCalledWith("/credits/me/transactions", {
            params: filtered, signal: undefined,
        });
    });

    it("distinguishes provisioning from empty history", async () => {
        respond({ status: "PROVISIONING" });
        await expect(getCreditTransactionsService(params)).resolves.toEqual({ status: "PROVISIONING" });
        respond({ status: "READY", items: [], nextCursor: null });
        await expect(getCreditTransactionsService(params)).resolves.toEqual({
            status: "READY", items: [], nextCursor: null,
        });
    });

    it.each([
        { ...transaction, amount: -50 },
        { ...transaction, availableDelta: 1.5 },
        { ...transaction, orderId: undefined },
        { ...transaction, createdAt: "invalid" },
        { ...transaction, type: "UNKNOWN" },
    ])("rejects malformed transaction data", async item => {
        respond({ status: "READY", items: [item], nextCursor: null });
        await expect(getCreditTransactionsService(params)).rejects.toThrow("Invalid credit transactions response");
    });

    it("does not turn request failures into provisioning or empty history", async () => {
        const error = new Error("Service unavailable");
        vi.mocked(creditApi.get).mockRejectedValue(error);
        await expect(getCreditTransactionsService(params)).rejects.toThrow("Service unavailable");
    });
});
