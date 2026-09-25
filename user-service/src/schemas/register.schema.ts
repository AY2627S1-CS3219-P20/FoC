import { z } from "zod";

export const registerSchema = z.strictObject({
  username: z
    .string()
    .min(3, "Username must have at least 3 characters")
    .max(30, "Username must have at most 30 characters")
    .regex(/^[A-Za-z0-9]+$/, "Use only letters and numbers"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address" })),
  phoneNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[ -]/g, ""))
    .pipe(
      z
        .string()
        .regex(
          /^(?:\+65)?[89]\d{7}$/,
          "Enter an 8-digit Singapore mobile number starting with 8 or 9",
        ),
    )
    .transform((value) => (value.startsWith("+65") ? value : `+65${value}`)),
  password: z
    .string()
    .min(8, "Password must have at least 8 characters")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number")
    .regex(/[\p{P}\p{S}]/u, "Include a special character"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
