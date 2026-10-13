import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "@tanstack/react-form";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import SupplierSelect from "./SupplierSelect";
import DateTimePicker from "./DateTimePicker";
import type { Order, ViewerRole } from "../types/order.types";
import { useOrderRelatedUserDetails } from "../hooks/useOrderRelatedUserDetails";

type RequestActivityDetailsDialogProps = {
    order: Order;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canEdit: boolean;
    viewerRole: ViewerRole;
    pickupSupplierName?: string;
    deliverySupplierName?: string;
    isSuppliersLoading: boolean;
};

const DetailText = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground text-wrap">{value || "—"}</p>
    </div>
);

const RequestActivityDetailsDialog = ({
    order,
    open,
    onOpenChange,
    canEdit,
    viewerRole,
    pickupSupplierName,
    deliverySupplierName,
    isSuppliersLoading,
}: RequestActivityDetailsDialogProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const relatedDetailsQuery = useOrderRelatedUserDetails(
        order,
        viewerRole,
        open,
    );

    const userId =
        viewerRole === "requester" ? order.courierId : order.requesterId;
    const relatedPersonLabel =
        viewerRole === "requester" ? "Courier" : "Requester";
    const relatedPerson = relatedDetailsQuery.data;

    const form = useForm({
        defaultValues: {
            name: order.name,
            description: order.description ?? "",
            pickupSupplierId: order.pickupSupplierId,
            deliverySupplierId: order.deliverySupplierId,
            offeredCredits: String(order.offeredCredits),
            expiryAt: format(new Date(order.expiryAt), "yyyy-MM-dd'T'HH:mm"),
            remarks: order.remarks ?? "",
        },
        validators: {},
        onSubmit: async () => {
            setIsEditing(false);
        },
    });

    const closeDialog = (nextOpen: boolean) => {
        onOpenChange(nextOpen);

        if (!nextOpen) {
            form.reset();
            setIsEditing(false);
        }
    };

    const cancelEditing = () => {
        form.reset();
        setIsEditing(false);
    };

    return (
        <Dialog open={open} onOpenChange={closeDialog}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing
                            ? "Edit the details of your request"
                            : "Request Details"}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (isEditing) form.handleSubmit();
                    }}
                    className="flex flex-col gap-4"
                >
                    {!canEdit || !isEditing ? (
                        <div className="space-y-4">
                            <DetailText
                                label="Request name"
                                value={order.name}
                            />
                            <DetailText
                                label="Description"
                                value={order.description}
                            />
                            <DetailText
                                label="Pickup location"
                                value={
                                    isSuppliersLoading
                                        ? "Loading pickup location…"
                                        : pickupSupplierName ?? "Pickup location unavailable"
                                }
                            />
                            <DetailText
                                label="Delivery location"
                                value={
                                    isSuppliersLoading
                                        ? "Loading delivery location…"
                                        : deliverySupplierName ?? "Delivery location unavailable"
                                }
                            />
                            <DetailText
                                label="Offered credits"
                                value={String(order.offeredCredits)}
                            />
                            <DetailText
                                label="Expiry date and time"
                                value={format(
                                    new Date(order.expiryAt),
                                    "MMM d, yyyy, h:mm a",
                                )}
                            />
                            <DetailText label="Remarks" value={order.remarks ?? ""} />
                        </div>
                    ) : (
                        <FieldGroup>
                            <form.Field name="name">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor={field.name}>
                                            Request name
                                        </FieldLabel>
                                        <Input
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            disabled={!isEditing}
                                            onBlur={field.handleBlur}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                        />
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field name="description">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor={field.name}>
                                            Description
                                        </FieldLabel>
                                        <Textarea
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            disabled={!isEditing}
                                            onBlur={field.handleBlur}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                        />
                                    </Field>
                                )}
                            </form.Field>

                            <div className="flex w-full flex-col gap-4 md:flex-row">
                                <form.Field name="pickupSupplierId">
                                    {(field) => (
                                        <Field className="min-w-0 flex-1">
                                            <FieldLabel>
                                                Pickup location
                                            </FieldLabel>
                                            <SupplierSelect
                                                value={field.state.value}
                                                onChange={field.handleChange}
                                                disabled={!isEditing}
                                                displayName={
                                                    isSuppliersLoading
                                                        ? "Loading pickup location…"
                                                        : pickupSupplierName ?? "Pickup location unavailable"
                                                }
                                                placeholder="Select pickup location"
                                            />
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field name="deliverySupplierId">
                                    {(field) => (
                                        <Field className="min-w-0 flex-1">
                                            <FieldLabel>
                                                Delivery location
                                            </FieldLabel>
                                            <SupplierSelect
                                                value={field.state.value}
                                                onChange={field.handleChange}
                                                disabled={!isEditing}
                                                displayName={
                                                    isSuppliersLoading
                                                        ? "Loading delivery location…"
                                                        : deliverySupplierName ?? "Delivery location unavailable"
                                                }
                                                placeholder="Select delivery location"
                                            />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            <div className="flex w-full flex-col gap-4 md:flex-row">
                                <form.Field name="offeredCredits">
                                    {(field) => (
                                        <Field className="min-w-0 flex-1">
                                            <FieldLabel htmlFor={field.name}>
                                                Offered credits
                                            </FieldLabel>
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                type="number"
                                                value={field.state.value}
                                                disabled={!isEditing}
                                                onBlur={field.handleBlur}
                                                onChange={(event) =>
                                                    field.handleChange(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field name="expiryAt">
                                    {(field) => (
                                        <Field className="min-w-0 flex-1">
                                            <FieldLabel>
                                                Expiry date and time
                                            </FieldLabel>
                                            <DateTimePicker
                                                value={field.state.value}
                                                onChange={field.handleChange}
                                                onBlur={field.handleBlur}
                                                disabled={!isEditing}
                                            />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            <form.Field name="remarks">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor={field.name}>
                                            Remarks
                                        </FieldLabel>
                                        <Textarea
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            disabled={!isEditing}
                                            onBlur={field.handleBlur}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                        />
                                    </Field>
                                )}
                            </form.Field>
                        </FieldGroup>
                    )}

                    <div className="space-y-2 border-t pt-4">
                        <p className="font-medium text-base">{relatedPersonLabel} Details</p>

                        {!userId && viewerRole === "requester" ? (
                            <p className="text-sm text-muted-foreground">
                                No courier has accepted this request yet.
                            </p>
                        ) : relatedDetailsQuery.isPending ? (
                            <p className="text-sm text-muted-foreground">
                                Loading {relatedPersonLabel.toLowerCase()} details…
                            </p>
                        ) : relatedDetailsQuery.isError ? (
                            <p role="alert" className="text-sm text-destructive">
                                Could not load {relatedPersonLabel.toLowerCase()} details.
                            </p>
                        ) : relatedPerson ? (
                            <>
                                <DetailText label="Email" value={relatedPerson.email} />
                                <DetailText label="Username" value={relatedPerson.username} />
                                <DetailText label="Phone" value={relatedPerson.phoneNumber} />
                            </>
                        ) : null}
                    </div>

                    {canEdit && (
                        <div className="flex justify-end gap-2">
                            {isEditing ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={cancelEditing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="indigo">
                                        Save changes
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="button"
                                    variant="indigo"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Edit request
                                </Button>
                            )}

                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog >
    );
};

export default RequestActivityDetailsDialog;