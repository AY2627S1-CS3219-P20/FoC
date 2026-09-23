import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Supplier } from "@/types/api.types";

interface DeactivateModalProps {
    supplier: Supplier;
    isPending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeactivateModal = ({ supplier, isPending, onConfirm, onCancel }: DeactivateModalProps) => {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10">
                    <AlertTriangleIcon className="size-4 text-destructive" />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm leading-snug">
                        Are you sure you want to deactivate{" "}
                        <span className="font-medium">{supplier.name}</span>?
                    </p>
                    <p className="text-sm text-muted-foreground">
                        This supplier will be removed from the list available for new errand
                        requests. Existing orders with this supplier stay viewable.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    isLoading={isPending}
                    onClick={onConfirm}
                >
                    Deactivate supplier
                </Button>
            </div>
        </div>
    );
};

export default DeactivateModal;
