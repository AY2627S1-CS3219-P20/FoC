import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { ParsedError } from "@/utils/errorHandler";
import type { Order, RenewRequestPayload } from "../types/order.types";
import { requesterOrderHistoryQueryKeys } from "./requesterOrderQueryKeys";
import { courierOrderQueryKeys } from "./courierOrderQueryKeys";
import { creditKeys } from "@/features/credit/credit.keys";
import { renewRequestService } from "../services/order.requester.service";

export function useRenewRequest() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending, isError, error } = useMutation<
        Order, ParsedError, RenewRequestPayload
    >({
        mutationFn: ({ orderId, payload }) =>
            renewRequestService(orderId, payload),
        onSuccess: async (order) => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: requesterOrderHistoryQueryKeys.all,
                }),
                queryClient.invalidateQueries({
                    queryKey: courierOrderQueryKeys.all,
                }),
                queryClient.invalidateQueries({
                    queryKey: creditKeys.balance(order.requesterId),
                }),
                queryClient.invalidateQueries({
                    queryKey: creditKeys.transactions(order.requesterId),
                }),
            ]);

            toast.success("Request renewed successfully");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return {
        renewRequest: mutateAsync,
        isPending,
        isError,
        error,
    };
}