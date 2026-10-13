import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Order, UpdateRequestPayload } from "../types/order.types";
import type { ParsedError } from "@/utils/errorHandler";
import { updateRequestService } from "../services/order.requester.service";
import { requesterOrderHistoryQueryKeys } from "./useRequesterOrderHistory";
import { toast } from "react-toastify";

export function useUpdateRequest() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending, isSuccess, isError } = useMutation<Order, ParsedError, UpdateRequestPayload>({
        mutationFn: ({ orderId, expectedVersion, payload }) => updateRequestService(orderId, { ...payload, expectedVersion }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: requesterOrderHistoryQueryKeys.all,
            });
            toast.success("Request updated successfully");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return {
        updateRequest: mutateAsync,
        isPending,
        isSuccess,
        isError,
    };
}

export default useUpdateRequest;