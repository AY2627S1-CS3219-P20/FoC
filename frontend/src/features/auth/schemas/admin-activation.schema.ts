import { z } from 'zod';
import {
    passwordSchema,
    phoneNumberSchema,
    usernameSchema,
} from './register.schema';

export const adminActivationTokenSchema = z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid administrator activation link');

export const adminActivationFormSchema = z.strictObject({
    username: usernameSchema,
    phoneNumber: phoneNumberSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine(
    value => value.password === value.confirmPassword,
    {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    },
);

export type AdminActivationFormValues = z.infer<
    typeof adminActivationFormSchema
>;

export type AdminActivationPayload = Omit<
    AdminActivationFormValues,
    'confirmPassword'
> & { token: string };
