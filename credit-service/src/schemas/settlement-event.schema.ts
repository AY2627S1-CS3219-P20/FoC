import { z } from "zod";
import { reservationIdSchema } from "./reservation.schema.js";

export const MAX_SETTLEMENT_BYTES = 65_536;
export const settlementEventSchema = z.strictObject({
    eventId: reservationIdSchema,
    eventVersion: z.literal(1),
    eventType: z.literal("ORDER_RECEIVED"),
    occurredAt: z.iso.datetime({ offset: true }),
    orderId: reservationIdSchema,
    orderVersion: z.number().int().min(0).max(2_147_483_647),
    reservationId: reservationIdSchema,
    requesterId: reservationIdSchema,
    courierId: reservationIdSchema,
    amount: z.number().int().min(1).max(2_147_483_647),
    orderName: z.string().min(1).max(255),
});
export type SettlementEvent = z.infer<typeof settlementEventSchema>;
