import { ENDPOINTS } from "@/api/endpoints";
import supplierApi from "@/api/supplierApi";
import type { ApiResponse } from "@/types/api.types";
import type { ApiSupplierResponse } from "../types/supplier.type";

export const viewSuppliersInPage = async (page: number): Promise<ApiSupplierResponse> => {
    const response = await supplierApi.get<ApiResponse<ApiSupplierResponse>>(
        ENDPOINTS.supplier.viewSuppliersInPage(page)
    );

    return response.data.data!;
};