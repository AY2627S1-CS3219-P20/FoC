import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import useAuth from "@/hooks/useAuth";
import { getCreditTransactionsService } from "../services/credit.service";
import useCreditTransactions from "./useCreditTransactions";

vi.mock("@/hooks/useAuth");
vi.mock("../services/credit.service");

const student = {
    id: "student-one", role: "STUDENT" as const,
    email: "student@example.test", username: "Student", phoneNumber: "12345678",
};
const params: Parameters<typeof useCreditTransactions>[0] = { sort: "desc", limit: 20 };

function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
let client: QueryClient;

beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    vi.mocked(useAuth).mockReturnValue({
        restoreSession: async () => {},
        user: student, isAuthenticated: true, isInitializing: false,
    });
    vi.mocked(getCreditTransactionsService).mockReset();
    vi.mocked(getCreditTransactionsService).mockResolvedValue({ status: "READY", items: [], nextCursor: null });
});

it.each(["admin", "logged out", "initializing"])("does not fetch or retry for %s", async state => {
    vi.mocked(useAuth).mockReturnValue({
        restoreSession: async () => {},
        user: state === "admin" ? { ...student, role: "ADMIN" } : student,
        isAuthenticated: state !== "logged out", isInitializing: state === "initializing",
    });
    const { result } = renderHook(() => useCreditTransactions(params), { wrapper });
    await act(() => result.current.retry());
    expect(getCreditTransactionsService).not.toHaveBeenCalled();
});

it("loads student history and separates filter, sort, cursor, and account caches", async () => {
    const { result, rerender } = renderHook(
        (query: Parameters<typeof useCreditTransactions>[0]) => useCreditTransactions(query),
        { initialProps: params, wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const query of [
        { ...params, type: "RESERVATION" as const },
        { ...params, sort: "asc" as const },
        { ...params, cursor: "opaque" },
    ]) {
        rerender(query);
        await waitFor(() => expect(getCreditTransactionsService).toHaveBeenLastCalledWith(query, expect.any(AbortSignal)));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    }
    vi.mocked(useAuth).mockReturnValue({
        restoreSession: async () => {},
        user: { ...student, id: "student-two" }, isAuthenticated: true, isInitializing: false,
    });
    rerender(params);
    await waitFor(() => expect(getCreditTransactionsService).toHaveBeenCalledTimes(5));
});

it("parses errors and retries only on request", async () => {
    vi.mocked(getCreditTransactionsService).mockRejectedValueOnce(new Error("Unavailable"));
    const { result } = renderHook(() => useCreditTransactions(params), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unavailable");
    expect(getCreditTransactionsService).toHaveBeenCalledTimes(1);
    await act(() => result.current.retry());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
});
