import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  phoneNumberSchema,
  usernameSchema,
} from "./register.schema.js";

const positiveIntegerQuerySchema = (fieldName: string) =>
  z
    .string()
    .regex(/^\d+$/, `${fieldName} must be a positive integer`)
    .transform(Number)
    .refine((value) => value >= 1, `${fieldName} must be a positive integer`);

export const listUsersQuerySchema = z.strictObject({
  search: z
    .string()
    .trim()
    .max(100, "Search must be at most 100 characters")
    .optional()
    .transform((value) => value || undefined),
  role: z.enum(["STUDENT", "ADMIN"]).optional(),
  page: positiveIntegerQuerySchema("Page").default(1),
  pageSize: positiveIntegerQuerySchema("Page size")
    .refine((value) => value <= 100, "Page size must be at most 100")
    .default(20),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

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

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
