import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";

import type { ParsedError } from "@/utils/errorHandler";
import { viewSuppliersInPage } from "@/api/supplierApi";
import type { Supplier } from "@/types/api.types";
import SupplierCard from "@/features/supplier/components/SupplierCard";
import useAuth from "@/hooks/useAuth";
import { ROUTES } from "@/routes/routes";

const SupplierPage = () => {
    const { user } = useAuth();

    if (user?.role === "ADMIN") {
        return <Navigate to={ROUTES.ADMIN.MANAGE_SUPPLIERS} replace />;
    }

    const suppliersQuery = useQuery<Supplier[], ParsedError>({
        queryKey: ["suppliers"],
        queryFn: () => viewSuppliersInPage(1),
        refetchOnMount: "always",
    });

    const isLoading = suppliersQuery.isLoading;
    const isError = suppliersQuery.isError;
    const suppliers = suppliersQuery.data ?? [];

    return (
        <>
            <div className="flex flex-col items-start justify-between gap-4 px-5 md:px-10 py-5">
                <h1 className="text-xl md:text-2xl font-bold">Suppliers</h1>
            </div>

            <div className="px-5 md:px-10 pb-10">
                {isLoading && <p>Loading suppliers...</p>}
                {isError && <p>Failed to load suppliers: {suppliersQuery.error.message}</p>}

                {!isLoading && !isError && suppliers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No suppliers yet.</p>
                )}

                {suppliers.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {suppliers.map(supplier => (
                            <SupplierCard key={supplier.id} supplier={supplier} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default SupplierPage;
