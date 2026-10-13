import { useQuery } from "@tanstack/react-query";
import { getUserByIdService } from "../services/order.requester.service";
import type { Order, ViewerRole } from "../types/order.types";

export function useOrderRelatedUserDetails(
    order: Order,
    viewerRole: ViewerRole,
    enabled: boolean,
) {
    const userId =
        viewerRole === "requester" ? order.courierId : order.requesterId;

    return useQuery({
        queryKey: ["orders", "related-user", viewerRole, userId],
        enabled: enabled && Boolean(userId),
        queryFn: () => getUserByIdService(userId!),
    });
}