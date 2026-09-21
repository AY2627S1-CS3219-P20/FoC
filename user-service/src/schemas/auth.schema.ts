import { z } from "zod";

export const loginSchema = z.object({
    email: z.email({ pattern: z.regexes.email, error: "Invalid email format" }),
    password: z.string().min(1, {
        error: "Password is required",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;