import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { parseError, type ParsedError } from '@/utils/errorHandler';
import type { ChangePasswordPayload } from '../schemas/password-change.schema';
import { changePasswordService } from '../services/user.service';

const useChangePassword = () => {
    const mutation = useMutation<void, ParsedError, ChangePasswordPayload>({
        mutationFn: async payload => {
            try {
                await changePasswordService(payload);
            } catch (error) {
                throw parseError(error);
            }
        },
        onSuccess: () => {
            toast.success('Password changed successfully.');
        },
        onError: error => {
            toast.error(error.message);
        },
    });

    return {
        changePassword: mutation.mutate,
        isPending: mutation.isPending,
    };
};

export default useChangePassword;
