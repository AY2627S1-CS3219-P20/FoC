import { z } from "zod";

export const renewRequestSchema = z.object({
    expiryAt: z
        .string()
        .min(1, "Expiry date and time is required")
        .refine(
            (value) => new Date(value) > new Date(),
            "Expiry date and time must be in the future"
        )
        .transform((value) => new Date(value).toISOString()),
    expectedVersion: z.number().int().positive(),
});

export type RenewRequestFormInput = z.input<typeof renewRequestSchema>;
export type RenewRequestFormData = z.output<typeof renewRequestSchema>;
