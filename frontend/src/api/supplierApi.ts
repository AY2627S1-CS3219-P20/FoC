import createApiClient from "./axios";
import axios from "axios";
import { ENDPOINTS } from "@/api/endpoints";
import { getToken } from "@/utils/token";
import type { ApiResponse, CreateSupplierInput, UpdateSupplierInput, Supplier } from "@/types/api.types";
import { parseError } from "@/utils/errorHandler";

export const supplierApi = createApiClient(
    import.meta.env.VITE_SUPPLIER_API_BASE_URL,
);

export const viewSuppliersInPage = async (page: number): Promise<Supplier[]> => {
    try {
        const response = await supplierApi.get<ApiResponse<{ message: string; data: Supplier[] }>>(
            `${ENDPOINTS.supplier.viewSuppliersInPage(page)}`,
        );

        return response.data.data?.data ?? [];
    } catch (error) {
        throw parseError(error);
    }
};

export const viewSuppliersForAdmin = async (page: number = 1): Promise<Supplier[]> => {
    try {
        const response = await supplierApi.get<ApiResponse<{ message: string; data: Supplier[] }>>(
            `${ENDPOINTS.supplier.viewSuppliersForAdmin}?page=${page}`,
        );

        return response.data.data?.data ?? [];
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

export const uploadSupplierImage = async (file: File): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append("image", file);
        const token = getToken();
        const response = await axios.post<ApiResponse<{ imageUrl: string }>>(
            `${import.meta.env.VITE_SUPPLIER_API_BASE_URL}${ENDPOINTS.supplier.uploadSupplierImage}`,
            formData,
            {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
        );
        const body = response.data.data;
        if (!body) {
            throw new Error("No image URL returned from server");
        }
        return body.imageUrl;
    } catch (error) {
        throw parseError(error);
    }
};

export default supplierApi;
