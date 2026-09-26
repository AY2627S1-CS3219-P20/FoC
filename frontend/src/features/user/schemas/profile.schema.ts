import { z } from 'zod';
import {
    emailSchema,
    phoneNumberSchema,
    usernameSchema,
} from '@/features/auth/schemas/register.schema';

export const updateProfileSchema = z.strictObject({
    username: usernameSchema,
    phoneNumber: phoneNumberSchema,
});

export const profileDetailsSchema = z.strictObject({
    email: emailSchema,
    username: usernameSchema,
    phoneNumber: phoneNumberSchema,
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
