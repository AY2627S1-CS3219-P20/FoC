import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORDER_STATUSES, type Order, type OrderStatus } from "../types/order.types";
import { updateStatusSchema } from "../schemas/update-status.schema";
import useDropRequest from "../hooks/useDropRequest";
import usePickUpRequest from "../hooks/usePickUpRequest";
import useCompleteRequest from "../hooks/useCompleteRequest";

type StatusUpdateDialogProps = {
    order: Order;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const StatusUpdateDialog = ({
    order,
    open,
    onOpenChange
}: StatusUpdateDialogProps) => {
    // mapping for what the next status can be, given the current status
    const STATUS_UPDATES: Partial<Record<OrderStatus, OrderStatus[]>> = {
        "ACCEPTED": ["CANCELED", "PICKED_UP"],
        "PICKED_UP": ["COMPLETED"]
    };

    const PRETTY_PRINT_OPTIONS: Partial<Record<OrderStatus, string>> = {
        "PICKED_UP": "Pick up order",
        "CANCELED": "Cancel order",
        "COMPLETED": "Complete order",
    };

    const prettyPrintCurrentStatus = (status: OrderStatus) => {
        const words: string[] = (status as string).split("_");
        let prettyString = "";

        for (const word of words) {
            // capitalise first letter of each word and use small letters for all other letters
            const prettyWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + " ";
            prettyString += prettyWord; // append word
        }

        return prettyString.trim();
    };

    // hooks
    const { dropRequest, isPending: isDropping } = useDropRequest();
    const { pickUpRequest, isPending: isPickingUp }= usePickUpRequest();
    const { completeRequest, isPending: isCompleting }= useCompleteRequest();

    const updateStatus = async (order: Order, newStatus: OrderStatus) => {
        const currentStatus = order.status;
        const allowedNextStatuses = STATUS_UPDATES[currentStatus] ?? [];

        if (!allowedNextStatuses.includes(newStatus)) {
            // not allowed, simply return
            return; 
        }

        if (newStatus === ORDER_STATUSES[2]) { // new status is "PICKED_UP"
            await pickUpRequest(order.id);
            return;
        } else if (newStatus === ORDER_STATUSES[3]) { // new status is "COMPLETED"
            await completeRequest(order.id);
            return;
        } else if (newStatus === ORDER_STATUSES[5]) { // new status is "CANCELED"
            await dropRequest(order.id);
            return;
        }

        // unsupported new order status, simply return
        return; 
    };

    const form = useForm({
            validators: {
                onSubmit: updateStatusSchema
            },
            onSubmit: async ({ value }) => {
                const payload = updateStatusSchema.parse(value);
                await updateStatus(order, payload.newStatus);
                closeDialog(false);
            },
        });

    const closeDialog = (nextOpen: boolean) => {
        onOpenChange(nextOpen);

        if (!nextOpen) {
            form.reset();
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={closeDialog}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        Update Status - {order.name}
                    </DialogTitle>
                </DialogHeader>

                <div>
                    <span style={{ fontWeight: 'bold' }}>Current status:</span> {prettyPrintCurrentStatus(order.status)}
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.handleSubmit();
                    }}
                    className="flex flex-col gap-4"
                >
                    <FieldGroup>
                        <form.Field
                            name="newStatus"
                            children={field => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className="min-w-0 flex-1 flex-row items-center justify-start gap-2 *:w-auto">
                                        <FieldLabel htmlFor={field.name}><span style={{ fontWeight: 'bold' }}>New status:</span></FieldLabel>
                                        <Select
                                            value={field.state.value ?? null}
                                            onValueChange={(value) => {
                                                field.handleChange(value as OrderStatus);
                                            }}
                                        >
                                            <SelectTrigger className="w-48 bg-white">
                                                <SelectValue placeholder="Select an option"/>
                                            </SelectTrigger>
                                            <SelectContent alignItemWithTrigger={false}>
                                                {STATUS_UPDATES[order.status]?.map((value) => (
                                                    <SelectItem key={value} value={value}>{PRETTY_PRINT_OPTIONS[value]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {isInvalid && (<FieldError errors={field.state.meta.errors} />)}
                                    </Field>
                                );
                            }}
                        />
                    </FieldGroup>

                    <div className="flex justify-end gap-2">
                            <Button
                            type="button"
                            variant="outline"
                            onClick={() => closeDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="indigo" isLoading={isDropping || isPickingUp || isCompleting}>
                            Confirm
                        </Button>
                    </div>   
                </form>
            </DialogContent>   
        </Dialog>
    );
};

export default StatusUpdateDialog;