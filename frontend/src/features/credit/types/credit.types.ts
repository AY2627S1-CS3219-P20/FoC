export type CreditProvisioningResponse = {
    success: true;
    data: { status: "PROVISIONING" };
};

export type CreditBalanceReadyResponse = {
    success: true;
    data: {
        status: "READY";
        availableCredits: number;
        reservedCredits: number;
        updatedAt: string;
    };
};

export type CreditBalanceResponse = CreditBalanceReadyResponse | CreditProvisioningResponse;

export type CreditBalance = CreditBalanceResponse["data"];
