import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import type { ParsedError } from "@/utils/errorHandler";
import {
    viewSuppliersForAdmin,
    createSupplier,
    updateSupplier,
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
import type { Supplier, SupplierDay, CreateSupplierInput } from "@/types/api.types";
import type { SupplierFormValues } from "@/features/supplier/schemas/supplier.schema";
import { Button } from "@/components/ui/button";
import SupplierCard from "@/features/supplier/components/SupplierCard";
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

// The admin list endpoint returns only the suppliers for a single page and
// throws a 400 when a page is out of range. There is no count endpoint that
// includes deactivated suppliers, so the number of pages is derived on the
// frontend by probing pages (exponential scan + binary search => log N requests).
const viewHasSuppliers = async (page: number): Promise<boolean> => {
    try {
        const data = await viewSuppliersForAdmin(page);
        return data.length > 0;
    } catch {
        return false;
    }
};

const computeTotalPages = async (): Promise<number> => {
    if (!(await viewHasSuppliers(1))) return 0;

    let upper = 1;
    while (await viewHasSuppliers(upper)) {
        upper *= 2;
    }

    let low = Math.floor(upper / 2);
    let high = upper;
    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        if (await viewHasSuppliers(mid)) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return low;
};

const ManageSuppliersPage = () => {
    const queryClient = useQueryClient();
    const [currentPage, setCurrentPage] = useState(1);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierToDeactivate, setSupplierToDeactivate] = useState<Supplier | null>(null);

    const totalPagesQuery = useQuery<number, ParsedError>({
        queryKey: ["admin-suppliers-total-pages"],
        queryFn: computeTotalPages,
    });

    const totalPages = totalPagesQuery.data ?? 0;

    // The backend returns 400 for out-of-range pages; derive the effective (in-range)
    // page during render so the query stays valid even after the page count shrinks.
    const effectivePage = Math.min(currentPage, Math.max(1, totalPages));

    const suppliersQuery = useQuery<Supplier[], ParsedError>({
        queryKey: ["admin-suppliers", effectivePage],
        queryFn: () => viewSuppliersForAdmin(effectivePage),
    });

    const suppliersIsLoading = suppliersQuery.isLoading;
    const suppliersIsError = suppliersQuery.isError;
    // Backend returns 400 "No records found for this page" when there is nothing to show.
    const isNoRecords = suppliersIsError && suppliersQuery.error?.statusCode === 400;
    const suppliers = suppliersQuery.data ?? [];

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-suppliers"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["admin-suppliers-total-pages"] });
    };

    const goToPage = (page: number) => {
        if (page < 1 || page > totalPages || page === effectivePage) return;
        setCurrentPage(page);
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
            <div className="flex flex-col items-start justify-between gap-4 px-5 md:px-10 py-5">
                <h1 className="text-xl md:text-2xl font-bold">Manage Suppliers</h1>
                <Button
                    type="button"
                    variant="indigo"
                    size="lg"
                    onClick={() => setIsCreateOpen(true)}
                    className="self-start"
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
                            No suppliers yet.
                            <br />
                            Click “Create Supplier” to add one.
                        </p>
                    )}

                {suppliers.length > 0 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
