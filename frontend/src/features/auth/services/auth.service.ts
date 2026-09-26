import { ENDPOINTS } from "@/api/endpoints";
import type { ApiResponse } from "@/types/api.types";
import type {
    LoginPayload,
    AuthResult,
    RegistrationChallenge,
} from "@/features/auth/types/auth.types";
import type { RegisterPayload } from "@/features/auth/schemas/register.schema";
import authApi from "@/api/authApi";

export const loginService = async (
    payload: LoginPayload
): Promise<AuthResult> => {
    const response = await authApi.post<ApiResponse<AuthResult>>(
        ENDPOINTS.auth.login,
        payload
    );

    return response.data.data!;
};

export const logoutService = async (): Promise<void> => {
    await authApi.post(ENDPOINTS.auth.logout);
};

export const registerService = async (
    payload: RegisterPayload,
): Promise<RegistrationChallenge> => {
    const response = await authApi.post<ApiResponse<RegistrationChallenge>>(
        ENDPOINTS.auth.register,
        payload,
    );

    return response.data.data!;
};
