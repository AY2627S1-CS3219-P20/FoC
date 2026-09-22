// For testing purposes
import { ENDPOINTS } from "@/api/endpoints";
import supplierApi from "@/api/supplierApi";
import type { ApiResponse } from "@/types/api.types";
import { parseError, type ParsedError } from "@/utils/errorHandler";
import { useQuery } from "@tanstack/react-query";

export const viewAllAvailableSuppliers = async (): Promise<unknown> => {
    const response = await supplierApi.get<ApiResponse<unknown>>(
        ENDPOINTS.supplier.viewAllAvailableSuppliers
    );

    return response.data.data!;
};

const useSuppliers = () => {
    return useQuery<unknown, ParsedError>({
        queryKey: ["suppliers"],
        queryFn: async () => {
            try {
                return await viewAllAvailableSuppliers();
            } catch (rawError) {
                throw parseError(rawError);
            }
        },
        refetchOnMount: "always",
    });
};

const SupplierPage = () => {
    const { data: suppliers, isLoading, isError, error } = useSuppliers();

    return (
        <>
            <div className="flex flex-col items-start justify-center gap-5 px-5 md:px-10 py-5">
                {isLoading && <p>Loading suppliers...</p>}
                {isError && <p>Failed to load suppliers: {error.message}</p>}
                <h1 className="text-xl md:text-2xl font-bold">Suppliers</h1>
            </div>
        </>
    );
};

export default SupplierPage;
