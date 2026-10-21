import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Order } from "../types/order.types";
import type { ParsedError } from "@/utils/errorHandler";
import { pickUpRequestService } from "../services/order.courier.service";
import { courierOrderQueryKeys } from "./courierOrderQueryKeys";
import { toast } from "react-toastify";

export function usePickUpRequest() {
    const queryClient = useQueryClient();

    const { mutateAsync, isPending, isSuccess, isError } = useMutation<Order, ParsedError, string>({
        mutationFn: (orderId) => pickUpRequestService(orderId),
        onSuccess: async () => {
            queryClient.invalidateQueries({
                queryKey: courierOrderQueryKeys.all,
            });

            toast.success("Request picked up");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    return {
        pickUpRequest: mutateAsync,
        isPending,
        isSuccess,
        isError,
    };
}

export default usePickUpRequest;