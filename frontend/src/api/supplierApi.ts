import createApiClient from "./axios";

const supplierApi = createApiClient(
    import.meta.env.VITE_SUPPLIER_API_BASE_URL,
);

export default supplierApi;