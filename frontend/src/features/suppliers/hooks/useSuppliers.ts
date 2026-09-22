import type { ApiSupplierResponse } from "../types/supplier.type";
import { parseError, type ParsedError } from "@/utils/errorHandler";
import { viewSuppliersInPage } from "../services/supplier.service";
import { useQuery } from "@tanstack/react-query";

const useSuppliers = (page: number) => {
    return useQuery<ApiSupplierResponse, ParsedError>({
        queryKey: ["suppliers"],
        queryFn: async () => {
            try {
                return await viewSuppliersInPage(page);
            } catch (rawError) {
                throw parseError(rawError);
            }
        },
        refetchOnMount: "always",
    });
};

export default useSuppliers;