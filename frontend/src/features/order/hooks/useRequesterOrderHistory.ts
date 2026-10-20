import type { RequesterOrderHistoryParams, RequesterOrderHistoryResponse } from "@/features/order/types/order.types";
import { useQuery } from "@tanstack/react-query";
import { getRequesterOrderHistoryService } from "@/features/order/services/order.requester.service";
import type { ParsedError } from "@/utils/errorHandler";
import { requesterOrderHistoryQueryKeys } from "./requesterOrderQueryKeys";

export const useRequesterOrderHistory = (
    params: RequesterOrderHistoryParams
) => {
    return useQuery<RequesterOrderHistoryResponse, ParsedError>({
        queryKey: requesterOrderHistoryQueryKeys.history(params),
        queryFn: () => getRequesterOrderHistoryService(params),
        placeholderData: (previousData) => previousData,
        refetchInterval: 10_000, // Refetch every 10 seconds
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
    });
};
