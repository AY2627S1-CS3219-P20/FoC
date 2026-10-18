import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Order } from "../types/order.types";
import type { ParsedError } from "@/utils/errorHandler";
import { receiveRequestService } from "../services/order.requester.service";
import { courierOrderQueryKeys } from "./courierOrderQueryKeys";
import { requesterOrderHistoryQueryKeys } from "./requesterOrderQueryKeys";
import { toast } from "react-toastify";

export function useReceiveRequest() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending, isSuccess, isError } = useMutation<Order, ParsedError, string>({
        mutationFn: (orderId) => receiveRequestService(orderId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: courierOrderQueryKeys.all,
                }),
                queryClient.invalidateQueries({
                    queryKey: requesterOrderHistoryQueryKeys.all,
                })
            ]);
            toast.success("Request marked as received");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return {
        receiveRequest: mutateAsync,
        isPending,
        isSuccess,
        isError,
    };
}

export default useReceiveRequest;