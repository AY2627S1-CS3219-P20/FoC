import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import type { ParsedError } from "@/utils/errorHandler";
import type { SupplierType, SupplierTypeCount } from "@/types/api.types";
import { countSupplierTypes, deleteSupplierType } from "@/api/supplierApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusIcon, Trash2 } from "lucide-react";
import CreateSupplierTypeForm from '@/features/supplier/components/CreateSupplierTypeForm';

const ManageSupplierTypesPage = () => {
    const queryClient = useQueryClient();

    const countSupplierTypesQuery = useQuery<SupplierTypeCount[], ParsedError>({
        queryKey: ["count-supplier-types"],
        queryFn: () => countSupplierTypes(),
        refetchOnMount: "always",
    })

    const supplierTypesIsLoading = countSupplierTypesQuery.isLoading;
    const supplierTypesIsError = countSupplierTypesQuery.isError;
    const supplierTypes = countSupplierTypesQuery.data ?? [];

    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const deleteSupplierTypeMutation = useMutation({
        mutationFn: deleteSupplierType,
        onSuccess: (deletedType) => {
            toast.success(`Supplier type "${deletedType.type}" deleted`);
            queryClient.invalidateQueries({ queryKey: ['count-supplier-types'] });
        },
        onError: (error: ParsedError) => {
            toast.error(error.message);
        },
    });

    const handleTypeDelete = (type: SupplierType) => {
        deleteSupplierTypeMutation.mutate(type);
    }

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
                </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-4 px-5 md:px-10 py-5">
                {isCreateOpen && (
                    <CreateSupplierTypeForm
                        submitLabel="Add New Supplier Type"
                        onSuccess={() => { setIsCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['count-supplier-types'] }); }}
                        onCancel={() => setIsCreateOpen(false)}
                    />
                )}
            </div>

            <div className="flex flex-col w-full px-5 py-5 items-center justify-center md:px-10 py-5">
                {supplierTypesIsLoading && <p>Loading supplier types...</p>}
                {supplierTypesIsError && <p>Failed to load supplier types: {countSupplierTypesQuery.error.message}</p>}

                {!supplierTypesIsLoading && !supplierTypesIsError && supplierTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No supplier types yet.</p>
                )}

                <div className="w-full grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {supplierTypes.map((type) => (
                        <Card key={type.id} className="w-[150px] px-5 items-center flex flex-row overflow-hidden rounded-xl bg-card shadow-md ring-1 ring-foreground/10">
                            <div className="text-md w-2/3 justify-center">{type.type[0] + type.type.substring(1).toLowerCase()}</div>
                            {type.count === 0 &&
                                <Button
                                    className="bg-white hover:bg-gray-200"
                                    onClick={() => handleTypeDelete(type)}
                                    disabled={deleteSupplierTypeMutation.isPending} // disable button when mutation is pending
                                >
                                    <Trash2 className='w-1/3 justify-end text-red-600'/>
                                </Button>
                            }
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

export default ManageSupplierTypesPage;