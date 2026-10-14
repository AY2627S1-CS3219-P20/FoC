import { useQuery } from "@tanstack/react-query";
import type { CourierOrderHistoryParams, CourierOrderHistoryResponse } from "@/features/order/types/order.types";
import { getCourierOrderHistoryService } from "@/features/order/services/order.courier.service";
import { courierOrderQueryKeys } from "@/features/order/hooks/courierOrderQueryKeys";
import type { ParsedError } from "@/utils/errorHandler";

export const useCourierOrderHistory = (
    params: CourierOrderHistoryParams
) => {
    return useQuery<CourierOrderHistoryResponse, ParsedError>({
        queryKey: courierOrderQueryKeys.history(params),
        queryFn: () => getCourierOrderHistoryService(params),
        placeholderData: (previousData) => previousData,
        refetchInterval: 30_000, // Refetch every 30 seconds
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
    });
};
