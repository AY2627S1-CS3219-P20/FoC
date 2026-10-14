import type { CourierOrderHistoryParams, OpenOrdersQueryParams } from "@/features/order/types/order.types";

export const courierOrderQueryKeys = {
    all: ["courierOrder"] as const,
    history: (params: CourierOrderHistoryParams) =>
        [...courierOrderQueryKeys.all, "history", params] as const,
    open: (params: OpenOrdersQueryParams) =>
        [...courierOrderQueryKeys.all, "open", params] as const,
};
