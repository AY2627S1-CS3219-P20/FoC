import { Button } from "@/components/ui/button";
import type { CreditBalanceState } from "@/features/credit/hooks/useCreditBalance";

export interface CreditBalanceProps {
    state: CreditBalanceState;
    isBusy: boolean;
    onRetry: () => Promise<void>;
}

const CreditBalance = ({ state, isBusy, onRetry }: CreditBalanceProps) => {
    if (state.status === "hidden") return null;

    const canRetry = state.status === "unavailable" || state.status === "delayed";

    return (
        <div className="flex w-fit items-center gap-2 pr-3">
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label={state.status === "loading" ? "Loading credit balance" : undefined}
                className="flex flex-col items-start justify-center tabular-nums"
            >
                {(state.status === "ready" || state.status === "loading") && (
                    <>
                        <span className="whitespace-nowrap text-sm font-semibold">
                            {state.status === "ready" ? state.balance.availableCredits : "—"} Available Credits
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {state.status === "ready" ? state.balance.reservedCredits : "—"} Reserved Credits
                        </span>
                    </>
                )}
                {state.status === "provisioning" && (
                    <span className="text-sm font-semibold">Setting up credits</span>
                )}
                {state.status === "delayed" && (
                    <span className="max-w-52 text-xs text-muted-foreground">
                        Credit setup is taking longer than expected
                    </span>
                )}
                {state.status === "unavailable" && (
                    <span className="text-sm font-semibold">Credits unavailable</span>
                )}
            </div>
            {canRetry && (
                <Button
                    type="button"
                    variant="linkIndigo"
                    size="xs"
                    disabled={isBusy}
                    aria-label="Retry credit balance"
                    onClick={() => { void onRetry(); }}
                >
                    {isBusy ? "Retrying…" : "Retry"}
                </Button>
            )}
        </div>
    );
};

export default CreditBalance;
