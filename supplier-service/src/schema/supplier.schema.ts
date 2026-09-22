import { z } from "zod";

export const supplierSchema = z.object({
    page: z.coerce.number().int().positive(),
});

export type ViewSupplierInput = z.infer<typeof supplierSchema>;