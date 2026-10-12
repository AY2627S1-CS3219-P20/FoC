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
