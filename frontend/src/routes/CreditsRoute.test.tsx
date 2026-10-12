import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useAuthStore from "@/store/authStore";
import queryClient from "@/lib/queryClient";
import { creditKeys } from "@/features/credit/credit.keys";
import { getCreditBalanceService, getCreditTransactionsService } from "@/features/credit/services/credit.service";
import { deferred, readyHistory, student } from "@/test/creditFixtures";
import type { CreditTransactions } from "@/features/credit/types/credit.types";
import AppRouter from "./AppRouter";
import { ROUTES } from "./routes";

vi.mock("@/context/AuthContext", async importOriginal => {
    const original = await importOriginal<typeof import("@/context/AuthContext")>();
    return {
        ...original,
        AuthProvider: ({ children }: { children: ReactNode }) => (
            <original.AuthContext.Provider value={{ isInitializing: false, restoreSession: async () => {} }}>
                {children}
            </original.AuthContext.Provider>
        ),
    };
});
vi.mock("@/pages/LoginPage", () => ({ default: () => <h1>Login</h1> }));
vi.mock("@/features/credit/services/credit.service");

beforeEach(() => {
    useAuthStore.getState().clearAuth();
    queryClient.clear();
    window.history.replaceState({}, "", ROUTES.CREDITS);
    vi.mocked(getCreditBalanceService).mockReset().mockResolvedValue({
        status: "READY", availableCredits: 50, reservedCredits: 0, updatedAt: "2026-10-12T00:00:00.000Z",
    });
    vi.mocked(getCreditTransactionsService).mockReset().mockResolvedValue(readyHistory());
});

afterEach(() => { queryClient.clear(); });

it("redirects a signed-out visitor to login without credit requests", async () => {
    render(<AppRouter />);
    await screen.findByRole("heading", { name: "Login" });
    expect(window.location.pathname).toBe(ROUTES.LOGIN);
    expect(getCreditBalanceService).not.toHaveBeenCalled();
    expect(getCreditTransactionsService).not.toHaveBeenCalled();
});

it("blocks admins and hides the student credit link", async () => {
    useAuthStore.getState().setUser({ ...student, role: "ADMIN" });
    render(<AppRouter />);
    await screen.findByText("You do not have permission to access this page.");
    expect(screen.queryByRole("link", { name: "Credits" })).not.toBeInTheDocument();
    expect(getCreditBalanceService).not.toHaveBeenCalled();
    expect(getCreditTransactionsService).not.toHaveBeenCalled();
});

it("opens the existing Credits route/link and shares balance data with the navbar", async () => {
    useAuthStore.getState().setUser(student);
    render(<AppRouter />);
    await screen.findByRole("heading", { name: "My credits" });
    await screen.findByRole("table");
    expect(screen.getByRole("link", { name: "Credits" })).toHaveAttribute("href", ROUTES.CREDITS);
    expect(screen.getByText("50 Available Credits")).toBeInTheDocument();
    expect(getCreditBalanceService).toHaveBeenCalledTimes(1);
});

it("clears credit caches and unmounts the page on promotion", async () => {
    useAuthStore.getState().setUser(student);
    render(<AppRouter />);
    await screen.findByRole("table");
    act(() => useAuthStore.getState().setUser({ ...student, role: "ADMIN" }));
    await screen.findByText("You do not have permission to access this page.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(queryClient.getQueriesData({ queryKey: creditKeys.transactions(student.id) })).toEqual([]);
});

it("cancels in-flight history on logout and does not restore it from a late response", async () => {
    const pending = deferred<CreditTransactions>();
    vi.mocked(getCreditTransactionsService).mockReturnValueOnce(pending.promise);
    useAuthStore.getState().setUser(student);
    render(<AppRouter />);
    await waitFor(() => expect(getCreditTransactionsService).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(getCreditTransactionsService).mock.calls[0][1];
    act(() => useAuthStore.getState().clearAuth());
    await screen.findByRole("heading", { name: "Login" });
    expect(signal?.aborted).toBe(true);
    await act(async () => { pending.resolve(readyHistory()); });
    expect(queryClient.getQueriesData({ queryKey: creditKeys.all })).toEqual([]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("clears the previous student's history on an account switch", async () => {
    useAuthStore.getState().setUser(student);
    render(<AppRouter />);
    await screen.findByRole("table");
    const pending = deferred<CreditTransactions>();
    vi.mocked(getCreditTransactionsService).mockReturnValueOnce(pending.promise);
    act(() => useAuthStore.getState().setUser({
        ...student, id: "00000000-0000-4000-8000-000000000020", username: "Another student",
    }));
    await waitFor(() => expect(getCreditTransactionsService).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(queryClient.getQueriesData({ queryKey: creditKeys.transactions(student.id) })).toEqual([]);
    await act(async () => { pending.resolve(readyHistory([])); });
    await screen.findByText("No transactions yet");
});
