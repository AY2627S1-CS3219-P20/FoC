import { z } from "zod";
import { reservationIdSchema } from "./reservation.schema.js";

export const MAX_SETTLEMENT_BYTES = 65_536;
const settlementBaseSchema = z.strictObject({
    eventId: reservationIdSchema,
    eventVersion: z.literal(1),
    occurredAt: z.iso.datetime({ offset: true }),
    orderId: reservationIdSchema,
    orderVersion: z.number().int().min(0).max(2_147_483_647),
    reservationId: reservationIdSchema,
    requesterId: reservationIdSchema,
    amount: z.number().int().min(1).max(2_147_483_647),
    orderName: z.string().min(1).max(255),
});
export const receiptEventSchema = settlementBaseSchema.extend({
    eventType: z.literal("ORDER_RECEIVED"),
    courierId: reservationIdSchema,
});
export const releaseEventSchema = settlementBaseSchema.extend({
    eventType: z.enum(["ORDER_CANCELED", "ORDER_EXPIRED"]),
});
export const settlementEventSchema = z.discriminatedUnion("eventType", [receiptEventSchema, releaseEventSchema]);
export type SettlementEvent = z.infer<typeof settlementEventSchema>;
