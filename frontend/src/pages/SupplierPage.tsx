import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import type { ParsedError } from "@/utils/errorHandler";
import {
    viewAllSuppliers,
    createSupplier,
    updateSupplier,
} from "@/api/supplierApi";
import useAuthStore from "@/store/authStore";
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

const SupplierPage = () => {
    const queryClient = useQueryClient();
    const isAdmin = useAuthStore(state => state.user?.role?.toLowerCase() === "admin");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const suppliersQuery = useQuery<Supplier[], ParsedError>({
        queryKey: ["suppliers"],
        queryFn: viewAllSuppliers,
        refetchOnMount: "always",
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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

    const handleSubmitForm = (values: SupplierFormValues, openHours: OpeningHourRow[]) => {
        const payload = buildPayload(values, openHours);

        if (editingSupplier) {
            updateMutation.mutate({ id: editingSupplier.id, input: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const isLoading = suppliersQuery.isLoading;
    const isError = suppliersQuery.isError;
    const suppliers = suppliersQuery.data ?? [];

    return (
        <>
            <div className="flex flex-col items-start justify-between gap-4 px-5 md:px-10 py-5">
                <h1 className="text-xl md:text-2xl font-bold">Suppliers</h1>
                {isAdmin && (
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
                )}
            </div>

            <div className="px-5 md:px-10 pb-10">
                {isLoading && <p>Loading suppliers...</p>}
                {isError && <p>Failed to load suppliers: {suppliersQuery.error.message}</p>}

                {!isLoading && !isError && suppliers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No suppliers yet.
                        {isAdmin && " Click “Create Supplier” to add one."}
                    </p>
                )}

                {suppliers.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {suppliers.map(supplier => (
                            <SupplierCard
                                key={supplier.id}
                                supplier={supplier}
                                onEdit={isAdmin ? () => setEditingSupplier(supplier) : undefined}
                            />
                        ))}
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
        </>
    );
};

export default SupplierPage;
