import { Card } from "@/components/ui/card";
import { statusVariant, type Order, type OrderStatus, type ViewerRole } from "../types/order.types";
import { AlarmClockIcon, CoinsIcon, FlagIcon, InfoIcon, MapPinIcon, PencilIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import RequestActivityDetailsDialog from "./RequestActivityDetailsDialog";
import StatusUpdateDialog from "./StatusUpdateDialog";
import { Skeleton } from "@/components/ui/skeleton";
import useAuth from "@/hooks/useAuth";
import { ROLES } from "@/features/auth/types/auth.types";
import RenewRequestDialog from "./RenewRequestDialog";
import { formatStringToTitleCase } from "@/utils/formatText";

type RequestActivityCardProps = {
    order: Order;
    isEditable?: boolean;
    isAcceptable?: boolean;
    viewerRole: ViewerRole;
    pickupSupplierName?: string;
    deliverySupplierName?: string;
    isSuppliersLoading: boolean;
}

const RequestActivityCard = ({
    order, isEditable, isAcceptable, viewerRole,
    pickupSupplierName, deliverySupplierName, isSuppliersLoading
}: RequestActivityCardProps) => {
    const canEditRequest =
        (isEditable ?? true) &&
        viewerRole === "requester" &&
        order.status === "OPEN" &&
        order.courierId === null;

    const canAccept = isAcceptable ?? false;
    const [open, setOpen] = useState(false);
    const editableStatuses: Partial<Record<OrderStatus, ViewerRole>> = {
        "ACCEPTED": "courier",
        "PICKED_UP": "courier",
        "COMPLETED": "requester",
        "OPEN": "requester",
    };
    const canEditStatus = Object.keys(editableStatuses).includes(order.status) && editableStatuses[order.status] === viewerRole;
    const [openStatusUpdateDialog, setOpenStatusUpdateDialog] = useState(false);

    const { user } = useAuth();
    const userRole = user?.role;

    const canRenewRequest =
        viewerRole === "requester" &&
        order.status === "EXPIRED" &&
        order.courierId === null &&
        !order.renewalPending;
    const [openRenewRequestDialog, setOpenRenewRequestDialog] = useState(false);

    const reservationFeedback =
        order.status === "PENDING_RESERVATION"
            ? "Request submitted. Confirming credit reservation…"
            : order.status === "RESERVATION_FAILED"
                ? "Credit reservation failed. Please try creating the request again."
                : order.status === "EXPIRED" && order.renewalPending
                    ? "Renewal submitted. Confirming credit reservation…"
                    : order.status === "EXPIRED" && order.renewalFailureCode
                        ? "Renewal failed. Your request is still expired. Please try again."
                        : null;

    return (
        <>
            <Card
                role="button"
                tabIndex={0}
                aria-label={`View details for ${order.name}`}
                className="flex h-full w-full cursor-pointer flex-col justify-between gap-2.5 p-4 hover:shadow-lg"
                onClick={(event) => {
                    event.preventDefault();
                    setOpen(true);
                }}
            >
                <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-lg lg:text-xl leading-none font-bold text-wrap">
                            {order.name}
                        </span>
                        <span className="text-sm leading-none text-slate-500 text-wrap">
                            {order.description}
                        </span>
                    </div>

                    {isSuppliersLoading ? (
                        <div className="flex items-center gap-1.5 text-sm">
                            <FlagIcon className="size-4 shrink-0 text-slate-500" />
                            <Skeleton className="h-4 w-36" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <FlagIcon className="size-4 shrink-0" />
                            <span>{pickupSupplierName ?? "Pickup location unavailable"}</span>
                        </div>
                    )}

                    {isSuppliersLoading ? (
                        <div className="flex items-center gap-1.5 text-sm">
                            <MapPinIcon className="size-4 shrink-0 text-slate-500" />
                            <Skeleton className="h-4 w-36" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <MapPinIcon className="size-4 shrink-0" />
                            <span>{deliverySupplierName ?? "Delivery location unavailable"}</span>
                        </div>
                    )}


                    <div className="flex flex-row items-center gap-1.5 text-sm text-slate-500">
                        <AlarmClockIcon className="size-4 shrink-0" />
                        <span className="leading-none text-wrap">
                            {format(new Date(order.expiryAt), "MMM d, yyyy, h:mm a")}
                        </span>
                    </div>
                </div>

                {reservationFeedback && (
                    <div className="flex flex-row items-center gap-1.5 text-sm text-muted-foreground">
                        <InfoIcon className="size-4 shrink-0" />
                        <span className="leading-none text-wrap">
                            {reservationFeedback}
                        </span>
                    </div>
                )}

                <div className="flex flex-row items-center justify-between border-t-2 border-slate-200 pt-2.5">
                    <div className="flex flex-row items-center gap-1.5 text-sm font-semibold">
                        <CoinsIcon className="size-4 shrink-0" />
                        <span className="leading-none text-wrap">
                            {order.offeredCredits}
                        </span>
                    </div>
                    {canEditStatus ? (
                        <Button
                            type="button"
                            variant={statusVariant[order.status]}
                            size="sm"
                            onClick={(event) => {
                                event.stopPropagation();
                                setOpenStatusUpdateDialog(true);
                            }}
                        >
                            <PencilIcon className="shrink-0" />
                            {formatStringToTitleCase(order.status)}
                        </Button>
                    ) : canRenewRequest ?
                        (
                            <Button
                                type="button"
                                variant={statusVariant[order.status]}
                                size="sm"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenRenewRequestDialog(true);
                                }}
                            >
                                <PencilIcon className="shrink-0" />
                                {formatStringToTitleCase(order.status)}
                            </Button>
                        )
                        : (
                            <Button
                                type="button"
                                variant={statusVariant[order.status]}
                                size="sm"
                                className="pointer-events-none"
                            >
                                {formatStringToTitleCase(order.status)}
                            </Button>
                        )}
                </div>
            </Card>

            <RequestActivityDetailsDialog
                order={order}
                open={open}
                onOpenChange={setOpen}
                canEditRequest={canEditRequest}
                canAccept={canAccept && userRole == ROLES.STUDENT}
                viewerRole={viewerRole}
                pickupSupplierName={pickupSupplierName}
                deliverySupplierName={deliverySupplierName}
                isSuppliersLoading={isSuppliersLoading}
            />

            <StatusUpdateDialog
                order={order}
                viewerRole={viewerRole}
                open={openStatusUpdateDialog}
                onOpenChange={setOpenStatusUpdateDialog}
            />

            <RenewRequestDialog
                order={order}
                open={openRenewRequestDialog}
                onOpenChange={setOpenRenewRequestDialog}
            />

        </>
    );
};

export default RequestActivityCard;