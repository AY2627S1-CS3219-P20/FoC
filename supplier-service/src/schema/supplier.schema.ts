import { z } from "zod";

export const supplierSchema = z.object({
    page: z.coerce.number().int().positive(),
});

export const typeSchema = z.object({
    type: z.string().toUpperCase() // ensure all types are saved in upper case
});

export type ViewSupplierInput = z.infer<typeof supplierSchema>;
export type TypeInput = z.infer<typeof typeSchema>;
