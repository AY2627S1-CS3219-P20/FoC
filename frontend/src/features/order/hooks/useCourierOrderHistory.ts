import { useQuery } from "@tanstack/react-query";
import type { CourierOrderHistoryParams, CourierOrderHistoryResponse } from "@/features/order/types/order.types";
import { getCourierOrderHistoryService } from "@/features/order/services/order.courier.service";
import type { ParsedError } from "@/utils/errorHandler";

export const courierOrderHistoryQueryKeys = {
    all: ["courierOrderHistory"] as const,
    history: (params: CourierOrderHistoryParams) =>
        [...courierOrderHistoryQueryKeys.all, "history", params] as const,
    open: () => [...courierOrderHistoryQueryKeys.all, "open"] as const,
};

export const useCourierOrderHistory = (
    params: CourierOrderHistoryParams
) => {
    return useQuery<CourierOrderHistoryResponse, ParsedError>({
        queryKey: courierOrderHistoryQueryKeys.history(params),
        queryFn: () => getCourierOrderHistoryService(params),
        placeholderData: (previousData) => previousData,
        refetchInterval: 30_000, // Refetch every 30 seconds
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
    });
};
