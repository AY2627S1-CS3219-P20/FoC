const BASE_AUTH = "/auth";
const BASE_USER = "/users";
const BASE_SUPPLIER = "/supplier";

export const ENDPOINTS = {

    auth: {
        login: `${BASE_AUTH}/login`,
        logout: `${BASE_AUTH}/logout`,
        refreshToken: `${BASE_AUTH}/refresh`,
        register: `${BASE_AUTH}/register`,
        resendRegistrationOtp: `${BASE_AUTH}/register/resend`,
        verifyRegistration: `${BASE_AUTH}/register/verify`,
    },

    user: {
        profile: `${BASE_USER}/me`,
        emailChange: `${BASE_USER}/me/email-change`,
        resendEmailChangeOtp: `${BASE_USER}/me/email-change/resend`,
        verifyEmailChange: `${BASE_USER}/me/email-change/verify`,
    },

    supplier: {
        viewSuppliersForAdmin: `${BASE_SUPPLIER}/all`,
        createSupplier: `${BASE_SUPPLIER}/`,
        updateSupplier: `${BASE_SUPPLIER}/:id`,
        deactivateSupplier: `${BASE_SUPPLIER}/:id/deactivate`,
        uploadSupplierImage: `${BASE_SUPPLIER}/upload-image`,
        viewSuppliersInPage: (page: number) => `${BASE_SUPPLIER}/?page=${page}`,
        countActiveSuppliers: `${BASE_SUPPLIER}/count-active-suppliers`,
        getAllSupplierTypes: `${BASE_SUPPLIER}/get-supplier-types`,
        createSupplierType: `${BASE_SUPPLIER}/new-supplier-type`,
        deleteSupplierType: `${BASE_SUPPLIER}/delete-supplier-type`,
        countSupplierType: `${BASE_SUPPLIER}/count-supplier-type`,
    },

} as const;
