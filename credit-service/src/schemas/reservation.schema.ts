import { z } from "zod";

export const reservationIdSchema = z.uuid().transform(value => value.toLowerCase());
export const reservationSchema = z.strictObject({
    reservationId: reservationIdSchema,
    orderId: reservationIdSchema,
    requesterId: reservationIdSchema,
    amount: z.number().int().min(1).max(2_147_483_647),
});
export type ReservationInput = z.infer<typeof reservationSchema>;
