import createApiClient from "./axios";
import axios from "axios";
import { ENDPOINTS } from "@/api/endpoints";
import { getToken } from "@/utils/token";
import type { ApiResponse, CreateSupplierInput, UpdateSupplierInput, Supplier, SupplierType, SupplierTypeCount } from "@/types/api.types";
import { parseError } from "@/utils/errorHandler";

export const supplierApi = createApiClient(
    import.meta.env.VITE_SUPPLIER_API_BASE_URL,
);

export const viewSuppliersInPage = async (page: number, searchString: string | null, typeFilter: string | null): Promise<Supplier[]> => {
    const requestBody = {
        searchString: searchString,
        typeFilter: typeFilter
    }
    try {
        const response = await supplierApi.post<ApiResponse<{ message: string; data: Supplier[] }>>(
            `${ENDPOINTS.supplier.viewSuppliersInPage(page)}`,
            { data: requestBody }
        );

        return response.data.data?.data ?? [];
    } catch (error) {
        throw parseError(error);
    }
};

export const countActiveSuppliers = async (searchString: string, typeFilter: string): Promise<number> => {
    const jsonBody = {
        searchString: searchString,
        typeFilter: typeFilter
    }
    try {
        const response = await supplierApi.post<ApiResponse<{ message: string; data: number }>>(
            `${ENDPOINTS.supplier.countActiveSuppliers}`,
            jsonBody
        );

        return response.data.data?.data ?? 0;
    } catch (error) {
        throw parseError(error);
    }
};

export const getAllSupplierTypes = async (): Promise<SupplierType[]> => {
    try {
        const response = await supplierApi.get<ApiResponse<{ message: string; data: SupplierType[] }>>(
            `${ENDPOINTS.supplier.getAllSupplierTypes}`,
        );

        return response.data.data?.data ?? [];
    } catch (error) {
        throw parseError(error);
    }
};

export const countSupplierTypes = async (): Promise<SupplierTypeCount[]> => {
    try {
        const response = await supplierApi.get<ApiResponse<{ message: string; data: SupplierType[] }>>(
            `${ENDPOINTS.supplier.countSupplierType}`,
        );

        return response.data.data?.data ?? [];
    } catch (error) {
        throw parseError(error);
    }
}

export const createSupplierType = async (type: string): Promise<SupplierType> => {
    const jsonBody = {
        type: type,
    }
    try {
        const response = await supplierApi.post<ApiResponse<{ message: string; data: SupplierType }>>(
            `${ENDPOINTS.supplier.createSupplierType}`,
            jsonBody
        );

        return response.data.data?.data!; // will always return the newly created supplier type
    } catch (error) {
        throw parseError(error);
    }
};

export const deleteSupplierType = async (type: SupplierTypeCount): Promise<SupplierType> => {
    const jsonBody = {
        id: type.id,
        type: type.type, 
    } // enforce the argument to be of SupplierType, which is expected by supplier-service
    try {
        const response = await supplierApi.post<ApiResponse<{ message: string; data: SupplierType }>>(
            `${ENDPOINTS.supplier.deleteSupplierType}`,
            jsonBody
        );

        return response.data.data?.data!; // will always return the deleted supplier type
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
