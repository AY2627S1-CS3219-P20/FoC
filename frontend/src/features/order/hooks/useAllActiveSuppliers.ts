import { useQuery } from "@tanstack/react-query";
import type { ParsedError } from "@/utils/errorHandler";
import { getActiveSuppliers, type SuppliersQueryParams, type SuppliersQueryResponse } from "@/api/supplierApi";

export const allActiveSuppliersQueryKey = ["suppliers", "active"] as const;

const suppliersQueryParams: SuppliersQueryParams = {
    page: undefined, // we want a list of all suppliers, no page needed
    searchString: undefined,
    typeFilter: undefined
}

export function useAllActiveSuppliers() {
    return useQuery<SuppliersQueryResponse, ParsedError>({
        queryKey: allActiveSuppliersQueryKey,
        queryFn: () => getActiveSuppliers(suppliersQueryParams),
    });
}
