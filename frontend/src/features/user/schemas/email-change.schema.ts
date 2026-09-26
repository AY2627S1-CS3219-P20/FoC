import { z } from 'zod';
import { emailSchema } from '@/features/auth/schemas/register.schema';

export const emailChangeSchema = z.strictObject({
    email: emailSchema,
});

export const emailChangeOtpSchema = z.strictObject({
    otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

export type EmailChangePayload = z.infer<typeof emailChangeSchema>;
export type EmailChangeOtpFields = z.infer<typeof emailChangeOtpSchema>;

export interface ResendEmailChangeOtpPayload {
    challengeId: string;
}

export interface VerifyEmailChangePayload extends EmailChangeOtpFields {
    challengeId: string;
}
