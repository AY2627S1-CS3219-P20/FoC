import { useQuery } from '@tanstack/react-query';
import { parseError, type ParsedError } from '@/utils/errorHandler';
import { getMyProfileService } from '../services/user.service';
import type { ApiUser } from '@/features/auth/types/auth.types';

export const PROFILE_QUERY_KEY = ['profile'] as const;

const useProfile = () => useQuery<ApiUser, ParsedError>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: async () => {
        try {
            const result = await getMyProfileService();
            return result.user;
        } catch (error) {
            throw parseError(error);
        }
    },
});

export default useProfile;
