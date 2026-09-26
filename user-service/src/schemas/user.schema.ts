import { z } from "zod";
import {
  emailSchema,
  phoneNumberSchema,
  usernameSchema,
} from "./register.schema.js";

export const updateMyProfileSchema = z
  .strictObject({
    username: usernameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
  })
  .refine(
    (value) => value.username !== undefined || value.phoneNumber !== undefined,
    { message: "Provide a username or phone number to update" },
  );

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export const startEmailChangeSchema = z.strictObject({
  email: emailSchema,
});

export const resendEmailChangeOtpSchema = z.strictObject({
  challengeId: z.uuid({ error: "Invalid email change challenge" }),
});

export const verifyEmailChangeSchema = z.strictObject({
  challengeId: z.uuid({ error: "Invalid email change challenge" }),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

export type StartEmailChangeInput = z.infer<typeof startEmailChangeSchema>;
export type ResendEmailChangeOtpInput = z.infer<typeof resendEmailChangeOtpSchema>;
export type VerifyEmailChangeInput = z.infer<typeof verifyEmailChangeSchema>;
