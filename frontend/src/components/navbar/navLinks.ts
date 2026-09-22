import { ROUTES } from "@/routes/routes";
import type { LucideIcon } from "lucide-react";
import {
    BoxesIcon,
    ClipboardListIcon,
    CoinsIcon,
    HouseIcon,
    ShapesIcon,
    UserIcon,
} from "lucide-react";

export interface NavLinkItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

export const studentNavLinks: NavLinkItem[] = [
    {
        label: "Home",
        href: ROUTES.HOME,
        icon: HouseIcon,
    },
    {
        label: "Activity",
        href: ROUTES.ACTIVITY,
        icon: ClipboardListIcon,
    },
    {
        label: "Suppliers",
        href: ROUTES.SUPPLIERS,
        icon: BoxesIcon,
    },
    {
        label: "Credits",
        href: ROUTES.CREDITS,
        icon: CoinsIcon,
    },
];

export const adminNavLinks: NavLinkItem[] = [
    {
        label: "Manage Users",
        href: ROUTES.ADMIN.MANAGE_USERS,
        icon: UserIcon,
    },
    {
        label: "Manage Suppliers",
        href: ROUTES.ADMIN.MANAGE_SUPPLIERS,
        icon: BoxesIcon,
    },
    {
        label: "Manage Supplier Types",
        href: ROUTES.ADMIN.MANAGE_SUPPLIER_TYPES,
        icon: ShapesIcon,
    },
    {
        label: "Manage Orders",
        href: ROUTES.ADMIN.MANAGE_ORDERS,
        icon: ClipboardListIcon,
    },
];