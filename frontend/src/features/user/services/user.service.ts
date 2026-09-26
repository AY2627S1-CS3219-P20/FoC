import authApi from '@/api/authApi';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/types/api.types';
import type { UpdateProfilePayload } from '../schemas/profile.schema';
import type {
    EmailChangePayload,
    ResendEmailChangeOtpPayload,
    VerifyEmailChangePayload,
} from '../schemas/email-change.schema';
import type {
    EmailChangeChallenge,
    EmailChangeVerificationResult,
    ProfileResult,
} from '../types/user.types';

export const getMyProfileService = async (): Promise<ProfileResult> => {
    const response = await authApi.get<ApiResponse<ProfileResult>>(
        ENDPOINTS.user.profile,
    );

    return response.data.data!;
};

export const updateMyProfileService = async (
    payload: UpdateProfilePayload,
): Promise<ProfileResult> => {
    const response = await authApi.patch<ApiResponse<ProfileResult>>(
        ENDPOINTS.user.profile,
        payload,
    );

    return response.data.data!;
};

export const startEmailChangeService = async (
    payload: EmailChangePayload,
): Promise<EmailChangeChallenge> => {
    const response = await authApi.post<ApiResponse<EmailChangeChallenge>>(
        ENDPOINTS.user.emailChange,
        payload,
    );

    return response.data.data!;
};

export const resendEmailChangeOtpService = async (
    payload: ResendEmailChangeOtpPayload,
): Promise<EmailChangeChallenge> => {
    const response = await authApi.post<ApiResponse<EmailChangeChallenge>>(
        ENDPOINTS.user.resendEmailChangeOtp,
        payload,
    );

    return response.data.data!;
};

export const verifyEmailChangeService = async (
    payload: VerifyEmailChangePayload,
): Promise<EmailChangeVerificationResult> => {
    const response = await authApi.post<ApiResponse<EmailChangeVerificationResult>>(
        ENDPOINTS.user.verifyEmailChange,
        payload,
    );

    return response.data.data!;
};
