import { z } from 'zod';
import { passwordSchema } from '@/features/auth/schemas/register.schema';

export const changePasswordSchema = z.strictObject({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine(
    value => value.newPassword === value.confirmPassword,
    {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    },
);

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type ChangePasswordPayload = Pick<
    ChangePasswordFormValues,
    'currentPassword' | 'newPassword'
>;
