import type { CreditTransactionType } from "../generated/prisma/client.js";

export type ProvisioningResponse = {
    success: true;
    data: { status: "PROVISIONING" };
};

export type BalanceReadyResponse = {
    success: true;
    data: {
        status: "READY";
        availableCredits: number;
        reservedCredits: number;
        updatedAt: string;
    };
};

export type BalanceResponse = BalanceReadyResponse | ProvisioningResponse;

export type CreditTransactionItem = {
    id: string;
    type: CreditTransactionType;
    amount: number;
    availableDelta: number;
    reservedDelta: number;
    createdAt: string;
    orderId: string | null;
};

export type TransactionsReadyResponse = {
    success: true;
    data: {
        status: "READY";
        items: CreditTransactionItem[];
        nextCursor: string | null;
    };
};

export type TransactionsResponse = TransactionsReadyResponse | ProvisioningResponse;
