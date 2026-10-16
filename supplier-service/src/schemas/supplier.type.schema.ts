import { z } from "zod";

export const supplierTypeSchema = z.object({
    type: z.string().toUpperCase() // ensure all types are saved in upper case
});

export type supplierTypeInput = z.infer<typeof supplierTypeSchema>;
