import { z } from "zod";
import { reservationIdSchema } from "./reservation.schema.js";

export const MAX_SETTLEMENT_BYTES = 65_536;
const settlementBaseSchema = z.strictObject({
    eventId: reservationIdSchema,
    orderId: reservationIdSchema,
    reservationId: reservationIdSchema,
    requesterId: reservationIdSchema,
    amount: z.number().int().min(1).max(2_147_483_647),
});
export const receiptEventSchema = settlementBaseSchema.extend({
    eventType: z.literal("ORDER_RECEIVED"),
    courierId: reservationIdSchema,
});
export const releaseEventSchema = settlementBaseSchema.extend({
    eventType: z.enum(["ORDER_CANCELED", "ORDER_EXPIRED"]),
});
export const refundEventSchema = settlementBaseSchema.extend({
    eventType: z.literal("ORDER_FAILED"),
});
export const settlementEventSchema = z.discriminatedUnion("eventType", [receiptEventSchema, releaseEventSchema, refundEventSchema]);
export type SettlementEvent = z.infer<typeof settlementEventSchema>;
