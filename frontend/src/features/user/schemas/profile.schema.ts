import { z } from 'zod';
import {
    phoneNumberSchema,
    usernameSchema,
} from '@/features/auth/schemas/register.schema';

export const updateProfileSchema = z.strictObject({
    username: usernameSchema,
    phoneNumber: phoneNumberSchema,
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
