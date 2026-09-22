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
        viewAllSuppliers: `${BASE_SUPPLIER}/all`,
        createSupplier: `${BASE_SUPPLIER}/`,
        updateSupplier: `${BASE_SUPPLIER}/:id`,
        deactivateSupplier: `${BASE_SUPPLIER}/:id/deactivate`,
        uploadSupplierImage: `${BASE_SUPPLIER}/upload-image`,
    },

} as const;