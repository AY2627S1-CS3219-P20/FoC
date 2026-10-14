import { Card } from "@/components/ui/card";
import type { Order, OrderStatus, ViewerRole } from "../types/order.types";
import { AlarmClockIcon, CoinsIcon, FlagIcon, MapPinIcon } from "lucide-react";
import { format } from "date-fns";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useState } from "react";
import RequestActivityDetailsDialog from "./RequestActivityDetailsDialog";
import { Skeleton } from "@/components/ui/skeleton";

const statusVariant: Record<OrderStatus, ButtonProps["variant"]> = {
    OPEN: "teal",
    ACCEPTED: "sky",
    PICKED_UP: "yellow",
    COMPLETED: "indigo200",
    RECEIVED: "green",
    CANCELLED: "gray",
    FAILED: "red",
    EXPIRED: "orange",
};

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
    const canEdit = isEditable ?? !order.courierId;
    const canAccept = isAcceptable ?? false;
    const [open, setOpen] = useState(false);

    return (
        <>
            <Card
                role="button"
                tabIndex={0}
                aria-label={`View details for ${order.name}`}
                className="flex h-full w-full cursor-pointer flex-col gap-2.5 p-4 hover:shadow-lg"
                onClick={(event) => {
                    event.preventDefault();
                    setOpen(true);
                }}
            >
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

                <div className="flex flex-row items-center justify-between border-t-2 border-slate-200 pt-2.5">
                    <div className="flex flex-row items-center gap-1.5 text-sm font-semibold">
                        <CoinsIcon className="size-4 shrink-0" />
                        <span className="leading-none text-wrap">
                            {order.offeredCredits}
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant={statusVariant[order.status]}
                        size="sm"
                        onClick={(event) => {
                            event.stopPropagation();
                        }}
                    >
                        {order.status}
                    </Button>
                </div>
            </Card>

            <RequestActivityDetailsDialog
                order={order}
                open={open}
                onOpenChange={setOpen}
                canEdit={canEdit}
                canAccept={canAccept}
                viewerRole={viewerRole}
                pickupSupplierName={pickupSupplierName}
                deliverySupplierName={deliverySupplierName}
                isSuppliersLoading={isSuppliersLoading}
            />

        </>
    );
};

export default RequestActivityCard;