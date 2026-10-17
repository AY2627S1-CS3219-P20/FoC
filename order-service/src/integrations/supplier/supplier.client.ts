import axios from "axios";
import config from "../../config/config.js";
import { AppError } from "../../errors/errors.js";
import { createApiClient } from "../../libs/api-client.js";

const SUPPLIER_SERVICE_URL = config.supplierServiceUrl;

export async function verifySupplierExists(
    supplierId: string,
    accessToken: string
): Promise<boolean> {
    const ApiClient = createApiClient(
        SUPPLIER_SERVICE_URL,
        accessToken
    );

    try {
        await ApiClient.get(`/api/suppliers/${supplierId}`);
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

