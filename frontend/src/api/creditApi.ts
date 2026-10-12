import createApiClient from "./axios";

const creditApi = createApiClient(
    import.meta.env.VITE_CREDIT_API_BASE_URL,
);

export default creditApi;
