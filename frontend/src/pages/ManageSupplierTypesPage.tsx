import { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ParsedError } from "@/utils/errorHandler";
import type { SupplierType } from "@/types/api.types";
import { getAllSupplierTypes } from "@/api/supplierApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import CreateSupplierTypeForm from '@/features/supplier/components/CreateSupplierTypeForm';

const ManageSupplierTypesPage = () => {
    const queryClient = useQueryClient();

    const supplierTypesQuery = useQuery<SupplierType[], ParsedError>({
        queryKey: ["get-supplier-types"],
        queryFn: () => getAllSupplierTypes(),
        refetchOnMount: "always",
    });

    const supplierTypesIsLoading = supplierTypesQuery.isLoading;
    const supplierTypesIsError = supplierTypesQuery.isError;
    const supplierTypes = supplierTypesQuery.data ?? [];

    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    return (
        <>
            <div className="flex flex-col items-start justify-between gap-4 px-5 md:px-10 py-5">
                <h1 className="text-xl md:text-2xl font-bold">Manage Suppliers</h1>
                <div className="flex flex-col gap-4 sm:flex-row">
                    <Button
                        type="button"
                        variant="indigo"
                        size="lg"
                        onClick={() => setIsCreateOpen(true)}
                        className="self-start"
                    >
                        <PlusIcon />
                        Create New Supplier Type
                    </Button>
                    {/* <Button
                        type="button"
                        variant="indigo"
                        size="lg"
                        onClick={() => setIsDeleteOpen(true)}
                        className="self-start"
                    >
                        <PlusIcon />
                        Delete Existing Supplier Type
                    </Button> */}
                </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-4 px-5 md:px-10 py-5">
                {isCreateOpen && (
                    <CreateSupplierTypeForm
                        submitLabel="Create Supplier"
                        onSuccess={() => { setIsCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['get-supplier-types'] }); }}
                        onCancel={() => setIsCreateOpen(false)}
                    />
                )}
            </div>

            <div className="flex flex-col w-full px-5 py-5 items-center justify-center md:px-10 py-5">
                {supplierTypesIsLoading && <p>Loading supplier types...</p>}
                {supplierTypesIsError && <p>Failed to load supplier types: {supplierTypesQuery.error.message}</p>}

                {!supplierTypesIsLoading && !supplierTypesIsError && supplierTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No supplier types yet.</p>
                )}

                <div className="w-full grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {supplierTypes.map((type) => (
                        <Card key={type.id} className="w-[150px] items-center justify-center flex flex-col overflow-hidden rounded-xl bg-card shadow-md ring-1 ring-foreground/10">
                            <div className="text-md">{type.type[0] + type.type.substring(1).toLowerCase()}</div>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

export default ManageSupplierTypesPage;