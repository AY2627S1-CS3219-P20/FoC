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
        viewSuppliersInPage: (page: number) => `${BASE_SUPPLIER}/?page=${page}`,
    },

} as const;