import type { RequesterOrderHistoryParams } from "../types/order.types";

export const requesterOrderHistoryQueryKeys = {
    all: ["requesterOrderHistory"] as const,
    history: (params: RequesterOrderHistoryParams) =>
        [...requesterOrderHistoryQueryKeys.all, "history", params] as const,
};
