import { z } from "zod";
import { ORDER_STATUSES } from "../types/order.types";

export const updateStatusSchema = z.object({
    newStatus: z.enum(ORDER_STATUSES)
});

export type UpdateStatusFormInput = z.input<typeof updateStatusSchema>;
