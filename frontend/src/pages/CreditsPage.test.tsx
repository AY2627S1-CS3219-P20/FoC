import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useAuth from "@/hooks/useAuth";
import useCreditBalance from "@/features/credit/hooks/useCreditBalance";
import { creditKeys } from "@/features/credit/credit.keys";
import { getCreditBalanceService, getCreditTransactionsService } from "@/features/credit/services/credit.service";
import { deferred, readyHistory, student } from "@/test/creditFixtures";
import type { CreditBalance } from "@/features/credit/types/credit.types";
import CreditsPage from "./CreditsPage";

vi.mock("@/hooks/useAuth");
vi.mock("@/features/credit/services/credit.service");

const readyBalance = {
    status: "READY", availableCredits: 50, reservedCredits: 10, updatedAt: "2026-10-12T00:00:00.000Z",
} as const;
let client: QueryClient;
const balanceService = vi.mocked(getCreditBalanceService);
const historyService = vi.mocked(getCreditTransactionsService);

beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    vi.mocked(useAuth).mockReturnValue({
        user: student, isAuthenticated: true, isInitializing: false, restoreSession: async () => {},
    });
    balanceService.mockReset().mockResolvedValue(readyBalance);
    historyService.mockReset().mockResolvedValue(readyHistory());
});

afterEach(() => { vi.useRealTimers(); client.clear(); });

function BalanceObserver() {
    const credit = useCreditBalance();
    return <output data-testid="shared-balance">{credit.state.status === "ready" ? credit.state.balance.availableCredits : credit.state.status}</output>;
}

const mount = (shared = false) => render(
    <QueryClientProvider client={client}>{shared && <BalanceObserver />}<CreditsPage /></QueryClientProvider>,
);

it("shares the balance query and displays available credits without subtracting reserved", async () => {
    mount(true);
    await screen.findByRole("table");
    expect(screen.getByLabelText("Available credit balance")).toHaveTextContent("50");
    expect(screen.getByLabelText("Reserved credit balance")).toHaveTextContent("10");
    expect(screen.getByTestId("shared-balance")).toHaveTextContent("50");
    expect(balanceService).toHaveBeenCalledTimes(1);
    act(() => client.setQueryData(creditKeys.balance(student.id), {
        ...readyBalance, availableCredits: 0, reservedCredits: 0, provisioningDeadline: null, setupDelayed: false,
    }));
    await waitFor(() => expect(screen.getByLabelText("Available credit balance")).toHaveTextContent(/^0$/));
    expect(screen.getByLabelText("Reserved credit balance")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("shared-balance")).toHaveTextContent(/^0$/);
});

it("shows loading placeholders and waits for a ready balance before loading history", async () => {
    const pending = deferred<CreditBalance>();
    balanceService.mockReturnValueOnce(pending.promise);
    mount();
    expect(screen.getByText("Loading credit balances…")).toBeInTheDocument();
    expect(screen.getByLabelText("Available credit balance")).toHaveTextContent("—");
    expect(historyService).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(readyBalance); });
    await screen.findByRole("table");
});

it("automatically loads history when provisioning completes", async () => {
    vi.useFakeTimers();
    balanceService.mockResolvedValueOnce({ status: "PROVISIONING" });
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText("Setting up credits")).toBeInTheDocument();
    expect(historyService).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByLabelText("Available credit balance")).toHaveTextContent("50");
    expect(historyService).toHaveBeenCalledTimes(1);
});

it("stops provisioning polls after the shared deadline and allows manual retry", async () => {
    vi.useFakeTimers();
    balanceService.mockResolvedValue({ status: "PROVISIONING" });
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText("Credit setup is taking longer than expected")).toBeInTheDocument();
    const calls = balanceService.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(balanceService).toHaveBeenCalledTimes(calls);
    expect(historyService).not.toHaveBeenCalled();
    expect(screen.queryByText("No transactions yet")).not.toBeInTheDocument();
    balanceService.mockResolvedValue(readyBalance);
    fireEvent.click(screen.getByRole("button", { name: "Retry credit setup" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByLabelText("Available credit balance")).toHaveTextContent("50");
});

it("handles an initial balance error and retries", async () => {
    balanceService.mockRejectedValueOnce(new Error("Balance service unavailable"));
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load credit balances");
    expect(historyService).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry credit balances" }));
    await screen.findByRole("table");
});

it("preserves valid history and labels stale balances when a balance refresh fails", async () => {
    mount();
    await screen.findByRole("table");
    balanceService.mockRejectedValueOnce(new Error("Balance service unavailable"));
    await act(() => client.refetchQueries({ queryKey: creditKeys.balance(student.id) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Showing previously loaded balances");
    expect(screen.getByRole("table")).toBeInTheDocument();
});

it("retains valid balances when history fails", async () => {
    historyService.mockRejectedValueOnce(new Error("History service unavailable"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load transactions");
    expect(screen.getByLabelText("Available credit balance")).toHaveTextContent("50");
});
