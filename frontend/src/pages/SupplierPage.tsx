import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import type { ParsedError } from "@/utils/errorHandler";
import { viewSuppliersInPage, countActiveSuppliers, getAllSupplierTypes } from "@/api/supplierApi";
import type { Supplier, SupplierType } from "@/types/api.types";
import SupplierCard from "@/features/supplier/components/SupplierCard";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";
import { Field } from '@/components/ui/field';
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { SearchIcon } from 'lucide-react';

const SupplierPage = () => {
    const LIMIT: number = 15;
    const [searchParams, setSearchParams] = useSearchParams();
    const currentPage = Number(searchParams.get("page")) || 1;

    // ensure the search string and type filters are saved to session storage
    // so that filters are still present when navigating between pages
    const [searchString, setSearchString] = useState(() => sessionStorage.getItem("searchString") ?? "");
    const [typeFilter, setTypeFilter] = useState(() => sessionStorage.getItem("typeFilter") ?? "all"); // default to viewing all types of suppliers
    useEffect(() => {
        sessionStorage.setItem("searchKey", searchString);
        sessionStorage.setItem("typeFilter", typeFilter);
    }, [searchString, typeFilter]);

    const handleSearchKeyInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log(searchString)
        setSearchParams({ page: '1' }) // reset the page to be 1 upon any change in search input
        setSearchString(event.target.value);
    }
    const handleFilterInput = (filter: string) => {
        setSearchParams({ page: '1' }) // reset the page to be 1 upon any change in type filter used
        setTypeFilter(filter.toUpperCase());
    }

    const suppliersQuery = useQuery<Supplier[], ParsedError>({
        queryKey: ["suppliers", currentPage, searchString, typeFilter],
        queryFn: () => viewSuppliersInPage(currentPage, searchString, typeFilter),
        refetchOnMount: "always",
    });

    const countActiveSuppliersQuery = useQuery<number, ParsedError>({
        queryKey: ["count-active-suppliers", searchString, typeFilter],
        queryFn: () => countActiveSuppliers(searchString, typeFilter),
        refetchOnMount: "always",
    });

    const supplierTypesQuery = useQuery<SupplierType[], ParsedError>({
        queryKey: ["get-supplier-types"],
        queryFn: () => getAllSupplierTypes(),
        refetchOnMount: "always",
    });

    const suppliersIsLoading = suppliersQuery.isLoading;
    const suppliersIsError = suppliersQuery.isError;
    const suppliers = suppliersQuery.data ?? [];
    const activeSupplierCount = countActiveSuppliersQuery.data ?? 0;
    const totalNumberOfPages = Math.ceil(activeSupplierCount / LIMIT);

    const supplierTypesIsLoading = supplierTypesQuery.isLoading;
    const supplierTypesIsError = supplierTypesQuery.isError;
    const supplierTypes = supplierTypesQuery.data ?? [];

    return (
        <>
            <div className="flex flex-col px-5 md:px-10 py-5 gap-4">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <h1 className="text-xl md:text-2xl font-bold">Suppliers</h1>
                    <Field className="w-full md:w-1/3">
                        <InputGroup className="bg-white h-10">
                            <InputGroupAddon align="inline-start">
                                <SearchIcon />
                            </InputGroupAddon>
                            <InputGroupInput
                                id="input-search-key"
                                type="text"
                                placeholder="Search for a supplier"
                                onChange={handleSearchKeyInput} />
                        </InputGroup>
                    </Field>

                </div>
                {supplierTypesIsLoading && <p>Loading supplier types...</p>}
                {supplierTypesIsError && <p>Failed to load supplier types: {supplierTypesQuery.error.message}</p>}

                {!supplierTypesIsLoading && !supplierTypesIsError && supplierTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No supplier types yet.</p>
                )}

                <Menubar className="w-fit max-w-full h-full flex flex-nowrap items-center justify-start gap-2.5 overflow-x-auto overflow-y-hidden">
                    <MenubarMenu>
                        <MenubarTrigger
                            key="all"
                            className={`p-2 shrink-0 whitespace-nowrap ${typeFilter === "ALL" ? "bg-accent!" : ""}`} // ensure that the filter is shown as selected on frontend
                            onClick={() => handleFilterInput("ALL")}
                        >
                            ALL
                        </MenubarTrigger>
                    </MenubarMenu>
                    {supplierTypes.map(type => (
                        <MenubarMenu>
                            <MenubarTrigger
                                key={type.id}
                                className={`p-2 shrink-0 whitespace-nowrap ${typeFilter === type.type ? "bg-accent!" : ""}`} // ensure that the filter is shown as selected on frontend
                                onClick={() => handleFilterInput(type.type)}
                            >
                                {type.type}
                            </MenubarTrigger>
                        </MenubarMenu>
                    ))}
                </Menubar>
            </div>

            <div className="px-5 md:px-10 pb-10">
                {suppliersIsLoading && <p>Loading suppliers...</p>}
                {suppliersIsError && <p>Failed to load suppliers: {suppliersQuery.error.message}</p>}

                {!suppliersIsLoading && !suppliersIsError && suppliers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No suppliers yet.</p>
                )}

                <div className="w-full flex flex-col gap-6">
                    {suppliers.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {suppliers.map(supplier => (
                                <SupplierCard key={supplier.id} supplier={supplier} />
                            ))}
                        </div>
                    )}

                    <Pagination className="p-2 border rounded-xl w-fit shadow-sm border-slate-200 bg-white">
                        <PaginationContent>
                            {currentPage > 1 && (
                                <PaginationItem>
                                    <PaginationPrevious
                                        href={`?page=${Math.max(currentPage - 1, 1)}`}
                                    />
                                </PaginationItem>
                            )}
                            {Array.from({ length: totalNumberOfPages }, (_, i) => (
                                <PaginationItem key={i}>
                                    <PaginationLink
                                        href={`?page=${i + 1}`}
                                    >
                                        {i + 1}
                                    </PaginationLink>
                                </PaginationItem>
                            ))}
                            {currentPage < totalNumberOfPages && (
                                <PaginationItem>
                                    <PaginationNext
                                        href={`?page=${Math.min(currentPage + 1, totalNumberOfPages)}`}
                                    />
                                </PaginationItem>
                            )}
                        </PaginationContent>
                    </Pagination>
                </div>
            </div>
        </>
    );
};

export default SupplierPage;
