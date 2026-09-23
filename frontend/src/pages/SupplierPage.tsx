import { useSearchParams } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import type { ParsedError } from "@/utils/errorHandler";
import { viewSuppliersInPage, countActiveSuppliers } from "@/api/supplierApi";
import type { Supplier } from "@/types/api.types";
import SupplierCard from "@/features/supplier/components/SupplierCard";
import { Card } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";

const SupplierPage = () => {
    const LIMIT: number = 15;
    const [searchParams] = useSearchParams();
    const currentPage = Number(searchParams.get("page")) || 1;


    const suppliersQuery = useQuery<Supplier[], ParsedError>({
        queryKey: ["suppliers"],
        queryFn: () => viewSuppliersInPage(currentPage),
        refetchOnMount: "always",
    });

    const countActiveSuppliersQuery = useQuery<number, ParsedError>({
        queryKey: ["count-active-suppliers"],
        queryFn: () => countActiveSuppliers(),
        refetchOnMount: "always",
    });

    const isLoading = suppliersQuery.isLoading;
    const isError = suppliersQuery.isError;
    const suppliers = suppliersQuery.data ?? [];
    const activeSupplierCount = countActiveSuppliersQuery.data ?? 0;
    const totalNumberOfPages = Math.ceil(activeSupplierCount / LIMIT);

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

                <Card className="w-fit p-5">
                    {suppliers.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {suppliers.map(supplier => (
                                <SupplierCard key={supplier.id} supplier={supplier} />
                            ))}
                        </div>
                    )}
                    <Pagination className="p-4 border-1 rounded-xl w-fit">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious 
                                    href={`?page=${Math.max(currentPage-1, 1)}`} 
                                />
                            </PaginationItem>
                            {Array.from({ length: totalNumberOfPages }, (_, i) => (
                                <PaginationItem key={i}>
                                    <PaginationLink 
                                        href={`?page=${i+1}`}
                                    >
                                        {i+1}
                                    </PaginationLink>
                                </PaginationItem>
                            ))}
                            <PaginationItem>
                                <PaginationNext 
                                    href={`?page=${Math.min(currentPage+1, totalNumberOfPages)}`} 
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </Card>
            </div>
        </>
    );
};

export default SupplierPage;
