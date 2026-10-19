import axios from "axios";
import config from "../../config/config.js";
import { AppError } from "../../errors/errors.js";

const supplierApi = axios.create({
    baseURL: config.supplierServiceUrl,
    timeout: 5_000,
    headers: {
        "X-Order-Supplier-Service-Secret":
            config.orderSupplierServiceToken,
    },
});

export async function verifySupplierExists(
    supplierId: string,
): Promise<boolean> {
    try {
        await supplierApi.get(`/api/internal/suppliers/${supplierId}`);
        return true;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;

            if (status === 404) {
                return false;
            }

            if (status === 401 || status === 403) {
                throw new AppError(
                    "Supplier Service authentication failed",
                    status
                );
            }
        }

        throw new AppError(
            "Unable to verify supplier with Supplier Service",
            502
        );
    }
}

