import { useQuery } from "@tanstack/react-query";
import type { ParsedError } from "@/utils/errorHandler";
import type { Supplier } from "@/types/api.types";
import { getAllActiveSuppliersService } from "@/api/supplierApi";

export const allActiveSuppliersQueryKey = ["suppliers", "active"] as const;

export function useAllActiveSuppliers() {
    return useQuery<Supplier[], ParsedError>({
        queryKey: allActiveSuppliersQueryKey,
        queryFn: getAllActiveSuppliersService,
    });
}