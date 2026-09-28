import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { PlusIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import type { ParsedError } from "@/utils/errorHandler";
import {
    countSuppliersForAdmin,
    viewSuppliersForAdmin,
    createSupplier,
    updateSupplier,
    getAllSupplierTypes,
} from "@/api/supplierApi";
import { deactivateSupplier } from "@/api/supplierDeactivateApi";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import DeactivateModal from "@/features/supplier/components/DeactivateModal";
import type { Supplier, SupplierDay, CreateSupplierInput, SupplierType } from "@/types/api.types";
import type { SupplierFormValues } from "@/features/supplier/schemas/supplier.schema";
import { Button } from "@/components/ui/button";
import SupplierCard from "@/features/supplier/components/SupplierCard";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import SupplierForm from "@/features/supplier/components/SupplierForm";
import SupplierModal from "@/features/supplier/components/SupplierModal";

interface OpeningHourRow {
    day: SupplierDay;
    openingTime: string;
    closingTime: string;
}

const buildPayload = (
    values: SupplierFormValues,
    openHours: OpeningHourRow[],
): CreateSupplierInput => {
    return {
        name: values.name,
        type: values.type,
        building: values.building?.trim() || null,
        floor: values.floor?.trim() ? Number(values.floor) : null,
        description: values.description,
        address: values.address,
        latitude: values.latitude?.trim() ? Number(values.latitude) : null,
        longitude: values.longitude?.trim() ? Number(values.longitude) : null,
        imageUrl: values.imageUrl ? values.imageUrl : null,
        openingHours: openHours
            .filter(hour => hour.day && hour.openingTime && hour.closingTime)
            .map(hour => ({
                day: hour.day,
                openingTime: hour.openingTime,
                closingTime: hour.closingTime,
            })),
    };
};

const ManageSuppliersPage = () => {
    const queryClient = useQueryClient();
    const [currentPage, setCurrentPage] = useState(1);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierToDeactivate, setSupplierToDeactivate] = useState<Supplier | null>(null);

    // keep the search string and type filter across navigations, matching the /suppliers page
    const [searchString, setSearchString] = useState(() => sessionStorage.getItem("searchString") ?? "");
    const [typeFilter, setTypeFilter] = useState(() => sessionStorage.getItem("typeFilter") ?? "all");
    useEffect(() => {
        sessionStorage.setItem("searchString", searchString);
        sessionStorage.setItem("typeFilter", typeFilter);
    }, [searchString, typeFilter]);

    const LIMIT = 15; // number of suppliers shown per page; kept in sync with the backend

    const totalPagesQuery = useQuery<number, ParsedError>({
        queryKey: ["admin-suppliers-total-pages", searchString, typeFilter],
        queryFn: () => countSuppliersForAdmin(searchString, typeFilter),
    });

    const totalPages = Math.ceil((totalPagesQuery.data ?? 0) / LIMIT);

    // The backend returns 400 for out-of-range pages; derive the effective (in-range)
    // page during render so the query stays valid even after the page count shrinks.
    const effectivePage = Math.min(currentPage, Math.max(1, totalPages));

    const suppliersQuery = useQuery<Supplier[], ParsedError>({
        queryKey: ["admin-suppliers", effectivePage, searchString, typeFilter],
        queryFn: () => viewSuppliersForAdmin(effectivePage, searchString, typeFilter),
        refetchOnMount: "always",
    });

    const supplierTypesQuery = useQuery<SupplierType[], ParsedError>({
        queryKey: ["admin-supplier-types"],
        queryFn: () => getAllSupplierTypes(),
        refetchOnMount: "always",
    });

    const suppliersIsLoading = suppliersQuery.isLoading;
    const suppliersIsError = suppliersQuery.isError;
    // Backend returns 400 "No records found for this page" when there is nothing to show.
    const isNoRecords = suppliersIsError && suppliersQuery.error?.statusCode === 400;
    const suppliers = suppliersQuery.data ?? [];

    const supplierTypesIsLoading = supplierTypesQuery.isLoading;
    const supplierTypesIsError = supplierTypesQuery.isError;
    const supplierTypes = supplierTypesQuery.data ?? [];

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-suppliers"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["admin-suppliers-total-pages"] });
    };

    const goToPage = (page: number) => {
        if (page < 1 || page > totalPages || page === effectivePage) return;
        setCurrentPage(page);
    };

    const handleSearchKeyInput = (event: ChangeEvent<HTMLInputElement>) => {
        setCurrentPage(1); // reset to the first page on any change in search input
        setSearchString(event.target.value);
    };

    const handleFilterInput = (filter: string) => {
        setCurrentPage(1); // reset to the first page on any change in type filter
        setTypeFilter(filter.toUpperCase());
    };

    const createMutation = useMutation({
        mutationFn: createSupplier,
        onSuccess: () => {
            toast.success("Supplier created");
            setIsCreateOpen(false);
            invalidate();
        },
        onError: (error: ParsedError) => {
            toast.error(error.message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, input }: { id: string; input: CreateSupplierInput }) =>
            updateSupplier(id, input),
        onSuccess: () => {
            toast.success("Supplier updated");
            setEditingSupplier(null);
            invalidate();
        },
        onError: (error: ParsedError) => {
            toast.error(error.message);
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: deactivateSupplier,
        onSuccess: () => {
            toast.success("Supplier deactivated");
            setSupplierToDeactivate(null);
            invalidate();
        },
        onError: (error: ParsedError) => {
            toast.error(error.message);
        },
    });

    const handleSubmitForm = (values: SupplierFormValues, openHours: OpeningHourRow[]) => {
        const payload = buildPayload(values, openHours);

        if (editingSupplier) {
            updateMutation.mutate({ id: editingSupplier.id, input: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-4 px-5 md:px-10 py-5">
                <div className="flex w-full items-start justify-between gap-4">
                    <h1 className="text-xl md:text-2xl font-bold">Manage Suppliers</h1>
                    <Field className="min-w-0 flex-1 lg:w-[500px]">
                        <Input
                            id="input-search-key"
                            type="text"
                            placeholder="Search for a supplier"
                            onChange={handleSearchKeyInput}
                        />
                    </Field>
                </div>

                {supplierTypesIsLoading && <p>Loading supplier types...</p>}
                {supplierTypesIsError && <p>Failed to load supplier types: {supplierTypesQuery.error?.message}</p>}
                {!supplierTypesIsLoading && !supplierTypesIsError && supplierTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No supplier types yet.</p>
                )}

                <Menubar className="w-fit">
                    <MenubarMenu>
                        <MenubarTrigger
                            key="all"
                            className={typeFilter === "ALL" ? "bg-accent text-accent-foreground" : ""}
                            onClick={() => handleFilterInput("ALL")}
                        >
                            ALL
                        </MenubarTrigger>
                    </MenubarMenu>
                    {supplierTypes.map(type => (
                        <MenubarMenu key={type.id}>
                            <MenubarTrigger
                                className={typeFilter === type.type ? "bg-accent text-accent-foreground" : ""}
                                onClick={() => handleFilterInput(type.type)}
                            >
                                {type.type}
                            </MenubarTrigger>
                        </MenubarMenu>
                    ))}
                </Menubar>
            </div>

            <div className="px-5 md:px-10 pb-4">
                <Button
                    type="button"
                    variant="indigo"
                    size="lg"
                    onClick={() => setIsCreateOpen(true)}
                    className="w-full self-start md:w-auto"
                >
                    <PlusIcon />
                    Create Supplier
                </Button>
            </div>

            <div className="px-5 md:px-10 pb-10">
                {suppliersIsLoading && <p>Loading suppliers...</p>}
                {suppliersIsError && !isNoRecords && (
                    <p>Failed to load suppliers: {suppliersQuery.error.message}</p>
                )}

                {!suppliersIsLoading &&
                    (isNoRecords || (!suppliersIsError && suppliers.length === 0)) && (
                        <p className="text-sm text-muted-foreground">
                            {searchString || typeFilter !== "all"
                                ? "No suppliers match the current search and filter."
                                : (
                                    <>
                                        No suppliers yet.
                                        <br />
                                        Click “Create Supplier” to add one.
                                    </>
                                )}
                        </p>
                    )}

                {suppliers.length > 0 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {suppliers.map(supplier => (
                                <SupplierCard
                                    key={supplier.id}
                                    supplier={supplier}
                                    onEdit={() => setEditingSupplier(supplier)}
                                    onDeactivate={() => setSupplierToDeactivate(supplier)}
                                />
                            ))}
                        </div>

                        {totalPages > 1 && !totalPagesQuery.isLoading && (
                            <Pagination className="flex justify-center">
                                <PaginationContent>
                                    {effectivePage > 1 && (
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    goToPage(effectivePage - 1);
                                                }}
                                            />
                                        </PaginationItem>
                                    )}
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <PaginationItem key={i}>
                                            <PaginationLink
                                                 href="#"
                                                 isActive={effectivePage === i + 1}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    goToPage(i + 1);
                                                }}
                                            >
                                                {i + 1}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    {effectivePage < totalPages && (
                                        <PaginationItem>
                                            <PaginationNext
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    goToPage(effectivePage + 1);
                                                }}
                                            />
                                        </PaginationItem>
                                    )}
                                </PaginationContent>
                            </Pagination>
                        )}

                        {totalPagesQuery.isLoading && totalPages > 1 && (
                            <p className="text-center text-sm text-muted-foreground">
                                Loading pagination...
                            </p>
                        )}
                    </div>
                )}
            </div>

            {isCreateOpen && (
                <SupplierModal
                    open={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    title="Create Supplier"
                >
                    <SupplierForm
                        submitLabel="Create Supplier"
                        isPending={createMutation.isPending}
                        onSubmit={handleSubmitForm}
                        onCancel={() => setIsCreateOpen(false)}
                    />
                </SupplierModal>
            )}

            {editingSupplier && (
                <SupplierModal
                    open={true}
                    onClose={() => setEditingSupplier(null)}
                    title="Edit Supplier"
                >
                    <SupplierForm
                        initialData={editingSupplier}
                        submitLabel="Save Changes"
                        isPending={updateMutation.isPending}
                        onSubmit={handleSubmitForm}
                        onCancel={() => setEditingSupplier(null)}
                    />
                </SupplierModal>
            )}

            {supplierToDeactivate && (
                <SupplierModal
                    open={true}
                    onClose={() => setSupplierToDeactivate(null)}
                    title="Deactivate Supplier"
                >
                    <DeactivateModal
                        supplier={supplierToDeactivate}
                        isPending={deactivateMutation.isPending}
                        onConfirm={() => deactivateMutation.mutate(supplierToDeactivate.id)}
                        onCancel={() => setSupplierToDeactivate(null)}
                    />
                </SupplierModal>
            )}
        </>
    );
};

export default ManageSuppliersPage;
