import axios from "axios";
import config from "../../config/config.js";
import { AppError } from "../../errors/errors.js";
import type { AbortReservationPayload, CreditReservation, CreditReservationResponse, RenewReservationPayload, ReservationPayload } from "../../types/order.types.js";

const creditApi = axios.create({
    baseURL: config.creditServiceUrl,
    timeout: 5_000,
    headers: {
        "X-Order-Credit-Service-Secret":
            config.orderCreditServiceToken,
    },
});

function handleCreditServiceError(error: unknown): never {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message;

        if (status && [400, 401, 403, 404, 409].includes(status)) {
            throw new AppError(
                typeof message === "string"
                    ? message
                    : "Credit Service request failed",
                status
            );
        }

        if (
            error.code === "ECONNABORTED" ||
            error.code === "ETIMEDOUT"
        ) {
            throw new AppError(
                "Credit Service request timed out",
                504
            );
        }
    }

    throw new AppError(
        "Unable to communicate with Credit Service",
        502
    );
}

export async function reserveCredits(
    payload: ReservationPayload
): Promise<CreditReservation> {
    try {
        console.log("Reserving credits with payload:", payload);
        const response = await creditApi.post<CreditReservationResponse>(
            "/api/internal/credits/reservations",
            payload
        );
        return response.data.data;
    } catch (error) {
        handleCreditServiceError(error);
    }
}

export async function abortReservation(
    payload: AbortReservationPayload
): Promise<CreditReservation> {
    try {
        const response = await creditApi.post<CreditReservationResponse>(
            `/api/internal/credits/reservations/${payload.reservationId}/abort`,
            payload
        );
        return response.data.data;
    } catch (error) {
        handleCreditServiceError(error);
    }
}

export async function renewCredits(
    payload: RenewReservationPayload
): Promise<CreditReservation> {
    try {
        console.log("Renewing credits with payload:", payload);
        const response = await creditApi.post<CreditReservationResponse>(
            `/api/internal/credits/reservations/renew`,
            payload
        );
        return response.data.data;
    } catch (error) {
        handleCreditServiceError(error);
    }
}