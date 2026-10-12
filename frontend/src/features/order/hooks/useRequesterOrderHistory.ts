import type { RequesterOrderHistoryParams, RequesterOrderHistoryResponse } from "@/features/order/types/order.types";
import { useQuery } from "@tanstack/react-query";
import { getRequesterOrderHistoryService } from "@/features/order/services/order.requester.service";
import type { ParsedError } from "@/utils/errorHandler";

export const requesterOrderHistoryQueryKeys = {
    all: ["requesterOrderHistory"] as const,
    history: (params: RequesterOrderHistoryParams) =>
        [...requesterOrderHistoryQueryKeys.all, "history", params] as const,
    completed: () => [...requesterOrderHistoryQueryKeys.all, "completed"] as const,
};

export const useRequesterOrderHistory = (
    params: RequesterOrderHistoryParams
) => {
    return useQuery<RequesterOrderHistoryResponse, ParsedError>({
        queryKey: requesterOrderHistoryQueryKeys.history(params),
        queryFn: () => getRequesterOrderHistoryService(params),
        placeholderData: (previousData) => previousData,
        refetchInterval: 30_000, // Refetch every 30 seconds
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
    });
};
