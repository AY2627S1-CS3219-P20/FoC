export const creditKeys = {
    all: ["credits"] as const,
    balance: (userId: string) => [...creditKeys.all, userId, "balance"] as const,
};
