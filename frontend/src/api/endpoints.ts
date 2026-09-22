const BASE_AUTH = "/auth";
const BASE_SUPPLIER = "/supplier";

export const ENDPOINTS = {

    auth: {
        login: `${BASE_AUTH}/login`,
        logout: `${BASE_AUTH}/logout`,
        refreshToken: `${BASE_AUTH}/refresh`,
    },

    user: {},

    supplier: {
        viewAllAvailableSuppliers: `${BASE_SUPPLIER}/`,
        createSupplier: `${BASE_SUPPLIER}/`,
        updateSupplier: `${BASE_SUPPLIER}/:id`,
        deactivateSupplier: `${BASE_SUPPLIER}/:id/deactivate`,
    },

} as const;