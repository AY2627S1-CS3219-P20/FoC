export const ROUTES = {
    // Public routes
    LOGIN: "/",
    REGISTER: "/register",

    // Protected routes for student roles
    HOME: "/home",
    ACTIVITY: "/activity",
    SUPPLIERS: "/suppliers",
    CREDITS: "/credits",

    // Protected routes for admin roles
    ADMIN: {
        MANAGE_USERS: "/admin/manage-users",
        MANAGE_SUPPLIERS: "/admin/manage-suppliers",
        MANAGE_SUPPLIER_TYPES: "/admin/supplier-types",
        MANAGE_ORDERS: "/admin/manage-orders",
    },

    // Protected routes for both student and admin roles
    PROFILE: "/profile",

} as const;