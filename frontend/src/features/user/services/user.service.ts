import authApi from '@/api/authApi';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/types/api.types';
import type { UpdateProfilePayload } from '../schemas/profile.schema';
import type { ProfileResult } from '../types/user.types';

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
