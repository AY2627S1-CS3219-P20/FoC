import { z } from "zod";

export const registrationEventSchema = z.strictObject({
    eventId: z.uuid(),
    eventType: z.literal("USER_REGISTERED"),
    eventVersion: z.literal(1),
    occurredAt: z.iso.datetime(),
    userId: z.uuid(),
    role: z.literal("STUDENT"),
});
