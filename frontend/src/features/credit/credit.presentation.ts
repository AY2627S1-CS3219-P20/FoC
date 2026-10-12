import type { CreditTransactionType } from "./types/credit.types";

export const transactionLabels: Record<CreditTransactionType, string> = {
    INITIAL_ALLOCATION: "Initial allocation",
    RESERVATION: "Credits reserved",
    TRANSFER_SENT: "Transfer sent",
    TRANSFER_RECEIVED: "Transfer received",
    RELEASE: "Reserved credits released",
    REFUND: "Refund",
};

export const transactionDescriptions: Partial<Record<CreditTransactionType, string>> = {
    INITIAL_ALLOCATION: "Starting credits for your account.",
    RESERVATION: "Moved from available to reserved for an errand.",
    RELEASE: "Previously reserved credits made available again.",
};

const numberFormatter = new Intl.NumberFormat();
const deltaFormatter = new Intl.NumberFormat(undefined, { signDisplay: "exceptZero" });
const timestampFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
});

export const formatCredits = (value: number) => numberFormatter.format(value);
export const formatCreditDelta = (value: number) => deltaFormatter.format(value);
export const formatCreditTimestamp = (value: string) => timestampFormatter.format(new Date(value));
export const creditTimeZone = timestampFormatter.resolvedOptions().timeZone;
