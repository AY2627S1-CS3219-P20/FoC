import { ClockIcon, MapPinIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Supplier, SupplierDay } from "@/types/api.types";

const DAY_ORDER: SupplierDay[] = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
];

const DAY_ABBR: Record<SupplierDay, string> = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
};

const formatTimeLabel = (value: string | Date): string => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const period = hours < 12 ? "am" : "pm";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes} ${period}`;
};

const formatHoursSummary = (openingHours: Supplier["openingHours"]): string => {
    const sorted = [...(openingHours ?? [])].sort(
        (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
    );

    return sorted
        .map(hour => `${DAY_ABBR[hour.day]} ${formatTimeLabel(hour.openingTime)}–${formatTimeLabel(hour.closingTime)}`)
        .join(" · ")
        .slice(0, 60);
};

interface SupplierCardProps {
    supplier: Supplier;
    onEdit?: () => void;
}

const SupplierCard = ({ supplier, onEdit }: SupplierCardProps) => {
    const isDeactivated = supplier.status === "DEACTIVATED";
    const showActions = Boolean(onEdit);

    return (
        <div
            className={[
                "group/card flex flex-col overflow-hidden rounded-xl bg-card shadow-md ring-1 ring-foreground/10",
                isDeactivated ? "opacity-60" : "",
            ].join(" ")}
        >
            {supplier.imageUrl ? (
                <img
                    src={supplier.imageUrl}
                    alt={supplier.name}
                    className="aspect-[3/2] w-full object-cover"
                />
            ) : (
                <div className="flex aspect-[3/2] w-full items-center justify-center bg-muted text-muted-foreground">
                    <MapPinIcon className="size-6" />
                </div>
            )}

            <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {supplier.type}
                        </span>
                        <h3 className="text-base leading-snug font-medium">
                            {supplier.name}
                        </h3>
                    </div>
                    <span
                        className={[
                            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            isDeactivated
                                ? "bg-muted text-muted-foreground"
                                : "bg-indigo-900 text-white",
                        ].join(" ")}
                    >
                        {isDeactivated ? "Deactivated" : "Active"}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPinIcon className="size-4 shrink-0" />
                    <span>
                        {supplier.building}, Floor {supplier.floor}
                    </span>
                </div>

                {supplier.description && (
                    <p className="text-sm leading-snug text-muted-foreground">
                        {supplier.description}
                    </p>
                )}

                {supplier.address && (
                    <p className="text-sm leading-snug text-muted-foreground">{supplier.address}</p>
                )}

                {supplier.openingHours && supplier.openingHours.length > 0 && (
                    <div className="mt-auto flex items-start gap-1.5 pt-2 text-sm text-muted-foreground">
                        <ClockIcon className="size-4 shrink-0 pt-0.5" />
                        <span>{formatHoursSummary(supplier.openingHours)}</span>
                    </div>
                )}

                {showActions && (
                    <div className="mt-2 flex items-center justify-end gap-2 border-t pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onEdit}
                        >
                            <PencilIcon className="size-4" />
                            Edit
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupplierCard;
