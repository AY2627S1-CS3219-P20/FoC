import createApiClient from "./axios";
import { ENDPOINTS } from "@/api/endpoints";
import type { ApiResponse, CreateSupplierInput, UpdateSupplierInput, Supplier } from "@/types/api.types";
import { parseError } from "@/utils/errorHandler";

export const supplierApi = createApiClient(
    import.meta.env.VITE_SUPPLIER_API_BASE_URL,
);

export const viewAllSuppliers = async (): Promise<Supplier[]> => {
    try {
        const response = await supplierApi.get<ApiResponse<Supplier[]>>(
            ENDPOINTS.supplier.viewAllAvailableSuppliers
        );

        const data = response.data.data;
        return Array.isArray(data) ? data : [];
    } catch (error) {
        throw parseError(error);
    }
};

export const createSupplier = async (input: CreateSupplierInput): Promise<Supplier> => {
    try {
        const response = await supplierApi.post<ApiResponse<Supplier>>(
            ENDPOINTS.supplier.createSupplier,
            input,
        );
        return response.data.data!;
    } catch (error) {
        throw parseError(error);
    }
};

export const updateSupplier = async (id: string, input: UpdateSupplierInput): Promise<Supplier> => {
    try {
        const url = ENDPOINTS.supplier.updateSupplier.replace(":id", id);
        const response = await supplierApi.patch<ApiResponse<Supplier>>(url, input);
        return response.data.data!;
    } catch (error) {
        throw parseError(error);
    }
};

export default supplierApi;
