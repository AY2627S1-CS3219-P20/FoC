import type { ApiResponse, Supplier } from "@/types/api.types";
import { ENDPOINTS } from "@/api/endpoints";
import { supplierApi } from "./supplierApi";
import { parseError } from "@/utils/errorHandler";

export const deactivateSupplier = async (id: string): Promise<Supplier> => {
    try {
        const url = ENDPOINTS.supplier.deactivateSupplier.replace(":id", id);
        const response = await supplierApi.patch<ApiResponse<Supplier>>(url);
        return response.data.data!;
    } catch (error) {
        throw parseError(error);
    }
};
