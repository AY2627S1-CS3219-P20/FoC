import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import useAuth from "@/hooks/useAuth";
import { deferred, initialTransaction, readyHistory, student } from "@/test/creditFixtures";
import { getCreditTransactionsService } from "../services/credit.service";
import type { CreditTransactions } from "../types/credit.types";
import CreditHistory from "./CreditHistory";

vi.mock("@/hooks/useAuth");
vi.mock("../services/credit.service");

let client: QueryClient;
const service = vi.mocked(getCreditTransactionsService);
const auth = () => ({ user: student, isAuthenticated: true, isInitializing: false, restoreSession: async () => {} });

beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    vi.mocked(useAuth).mockReturnValue(auth());
    service.mockReset();
    service.mockResolvedValue(readyHistory());
});

const mount = () => render(<QueryClientProvider client={client}><CreditHistory /></QueryClientProvider>);
const table = () => within(screen.getByRole("table"));
const waitForReady = async () => {
    await waitFor(() => expect(screen.queryByText("Loading transactions…")).not.toBeInTheDocument());
};

it("defaults to newest first/all types, preserves server order, and formats effects and errands", async () => {
    const orderId = "00000000-0000-4000-8000-000000000003";
    service.mockResolvedValue(readyHistory([
        { ...initialTransaction, id: "release", type: "RELEASE", amount: 10, availableDelta: 10, reservedDelta: -10, orderId },
        { ...initialTransaction, id: "reservation", type: "RESERVATION", amount: 10, availableDelta: -10, reservedDelta: 10, orderId },
        initialTransaction,
    ]));
    mount();
    await screen.findByRole("table");
    expect(service).toHaveBeenCalledWith({ sort: "desc", limit: 20, type: undefined, cursor: undefined }, expect.any(AbortSignal));
    expect(screen.getByLabelText("Sort by timestamp")).toHaveValue("desc");
    expect(screen.getByLabelText("Transaction type")).toHaveValue("");
    const rows = table().getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Reserved credits released");
    expect(rows[1]).toHaveTextContent("Available +10");
    expect(rows[1]).toHaveTextContent("Reserved -10");
    expect(rows[2]).toHaveTextContent("Credits reserved");
    expect(rows[2]).toHaveTextContent("Available -10");
    expect(rows[2]).toHaveTextContent("Reserved +10");
    expect(rows[3]).toHaveTextContent("50 credits");
    expect(within(rows[3]).getByLabelText("No associated errand")).toHaveTextContent("—");
    expect(table().queryByRole("link")).not.toBeInTheDocument();
    const time = rows[1].querySelector("time")!;
    expect(time).toHaveAttribute("dateTime", initialTransaction.createdAt);
    expect(time.textContent).not.toBe(initialTransaction.createdAt);
    expect(screen.getByRole("list", { name: "Credit transactions" })).toHaveClass("md:hidden");
    expect(screen.getByRole("table")).toHaveClass("hidden", "md:table");
});

it("supports next/previous and atomically resets pagination on sort and filter changes", async () => {
    service.mockImplementation(async params => readyHistory([
        { ...initialTransaction, amount: params.cursor ? 25 : 50 },
    ], params.cursor ? null : "next-page"));
    const user = userEvent.setup();
    mount();
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(table().getByText("25 credits")).toBeInTheDocument());
    expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "next-page" }), expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(table().getByText("50 credits")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.selectOptions(screen.getByLabelText("Sort by timestamp"), "asc");
    await waitFor(() => expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "asc", cursor: undefined }), expect.any(AbortSignal)));
    await waitForReady();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.selectOptions(screen.getByLabelText("Transaction type"), "RELEASE");
    await waitFor(() => expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "asc", type: "RELEASE", cursor: undefined }), expect.any(AbortSignal)));
    await waitForReady();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});

it("cancels old requests and never shows a late response under a new filter", async () => {
    const pending = deferred<CreditTransactions>();
    service.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    mount();
    expect(screen.getByText("Loading transactions…")).toBeInTheDocument();
    const firstSignal = service.mock.calls[0][1];
    service.mockResolvedValue(readyHistory([]));
    await user.selectOptions(screen.getByLabelText("Transaction type"), "REFUND");
    await screen.findByText("No transactions match this type");
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => { pending.resolve(readyHistory()); });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    await screen.findByText("No transactions yet");
});

it("refreshes live history from the first page", async () => {
    service.mockResolvedValue(readyHistory([initialTransaction], "next-page"));
    const user = userEvent.setup();
    mount();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitForReady();
    service.mockResolvedValue(readyHistory([{ ...initialTransaction, amount: 60 }]));
    await user.click(screen.getByRole("button", { name: "Refresh history" }));
    await waitFor(() => expect(table().getByText("60 credits")).toBeInTheDocument());
    expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }), expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});

it("handles provisioning without pretending history is empty and allows retry", async () => {
    service.mockResolvedValueOnce({ status: "PROVISIONING" });
    const user = userEvent.setup();
    mount();
    await screen.findByText("Transaction history is not ready yet");
    expect(screen.queryByText("No transactions yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry transactions" }));
    await screen.findByRole("table");
});

it("shows request errors and retries without hiding valid history", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("table");
    service.mockRejectedValueOnce(new Error("Service unavailable"));
    await user.click(screen.getByRole("button", { name: "Refresh history" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("They may be outdated");
    expect(table().getByText("50 credits")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry transactions" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

it("hides retained history after an authorization failure", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("table");
    service.mockRejectedValueOnce({ statusCode: 403, code: "FORBIDDEN", message: "Access denied" });
    await user.click(screen.getByRole("button", { name: "Refresh history" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("recovers from an invalid cursor by returning to page one", async () => {
    service.mockResolvedValueOnce(readyHistory([initialTransaction], "next-page"))
        .mockRejectedValueOnce({ statusCode: 400, code: "BAD_REQUEST", message: "Invalid cursor" });
    const user = userEvent.setup();
    mount();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Return to first page" }));
    await screen.findByRole("table");
    expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }), expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});

it("resets navigation when the account changes", async () => {
    service.mockResolvedValue(readyHistory([initialTransaction], "next-page"));
    const user = userEvent.setup();
    const view = mount();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitForReady();
    vi.mocked(useAuth).mockReturnValue({ ...auth(), user: { ...student, id: "another-student" } });
    view.rerender(<QueryClientProvider client={client}><CreditHistory /></QueryClientProvider>);
    await screen.findByRole("table");
    expect(service).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }), expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});
