import { setTimeout as delay } from "node:timers/promises";
import { OrderEventType, type PrismaClient } from "../generated/prisma/client.js";
import { connectOrderMessaging, publishOrderEvent, type SettlementOrderEventType } from "../libs/rabbitmq.js";

const BATCH_SIZE = 30; // The maximum number of outbox events to fetch and publish in a single batch.
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds for new orders to publish to RabbitMQ.
const MAX_BACKOFF_SECONDS = 60; // Wait up to 60 seconds before reconnecting to RabbitMQ after a failure.

// The types of event this publisher is responsible for
const SETTLEMENT_ORDER_EVENT_TYPES: SettlementOrderEventType[] = [
    OrderEventType.ORDER_RECEIVED,
    OrderEventType.ORDER_CANCELED,
    OrderEventType.ORDER_EXPIRED,
    OrderEventType.ORDER_FAILED,
];

// Check if the given event type is one of the settlement order event typesD
function isSettlementOrderEventType(
    eventType: OrderEventType
): eventType is SettlementOrderEventType {
    return SETTLEMENT_ORDER_EVENT_TYPES.includes(eventType as SettlementOrderEventType);
}

// Ensure the payload is a valid object and that the eventId in the payload matches the outbox entry ID. 
// Serialize the payload to a Buffer for publishing to RabbitMQ.
function serializePayload(payload: unknown, outboxId: string): Buffer {
    if (
        typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload)
    ) {
        throw new Error(`Outbox entry ${outboxId} has invalid payload`);
    }
    const eventPayload = payload as Record<string, unknown>;

    if (eventPayload.eventId !== outboxId) {
        throw new Error(
            `Outbox entry ${outboxId} has mismatched eventId in payload`
        );
    }

    return Buffer.from(JSON.stringify(eventPayload), "utf-8");
}

// Fetch up to BATCH_SIZE outbox events from the database, oldest first.
// Publish them one at a time and waits for publisher confirms from RabbitMQ before marking them as published in the database.
async function publishBatch(
    prisma: PrismaClient,
    channel: Awaited<ReturnType<typeof connectOrderMessaging>>["channel"],
): Promise<boolean> {

    // Fetch the oldest unpublished outbox events with supported event types, up to the batch size.
    const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
            publishedAt: null,
            eventType: {
                in: SETTLEMENT_ORDER_EVENT_TYPES,
            },
        },
        orderBy: [
            { createdAt: "asc" },
            { id: "asc" } // Ensure deterministic ordering for entries with the same createdAt timestamp
        ],
        take: BATCH_SIZE,
    });

    for (const entry of outboxEvents) {
        try {
            // Skip entries with unsupported event types, even though the query should have filtered them out.
            if (!isSettlementOrderEventType(entry.eventType)) {
                console.warn(
                    `Outbox entry ${entry.id} has unsupported event type ${entry.eventType}; skipping`
                );
                continue;
            }

            console.log(`Publishing outbox entry ${entry.id} of type ${entry.eventType} to RabbitMQ`);
            // Publish the event to RabbitMQ with publisher confirms.
            await publishOrderEvent(
                channel,
                entry.eventType,
                serializePayload(entry.payload, entry.id),
                {
                    messageId: entry.id,
                    correlationId: entry.orderId
                }
            );

            // Mark the entry as published in the database.
            await prisma.outboxEvent.updateMany({
                where: {
                    id: entry.id,
                    publishedAt: null
                },
                data: {
                    publishedAt: new Date(),
                    lastError: null
                }
            });
        } catch (error) {
            // If publishing fails, increment the retry count and log the error. 
            // The entry will be retried in the next polling cycle.
            await prisma.outboxEvent.updateMany({
                where: {
                    id: entry.id,
                    publishedAt: null
                },
                data: {
                    retryCount: { increment: 1 },
                    lastError: "PUBLISH_FAILED",
                }
            });

            console.error("Outbox publish failed", {
                outboxEventId: entry.id,
                retryCount: entry.retryCount + 1,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new Error("OUTBOX_PUBLISH_FAILED");
        }
    }

    return outboxEvents.length > 0;
}

export function startOrderOutboxPublisher(
    prisma: PrismaClient,
): () => Promise<void> {
    const abortController = new AbortController();

    async function runSession(): Promise<void> {
        console.log("Starting order outbox publisher session");
        const { connection, channel } = await connectOrderMessaging();

        try {
            while (!abortController.signal.aborted) {
                const foundEvents = await publishBatch(prisma, channel);
                // If no events were found, wait for the poll interval before checking again.
                if (!foundEvents) {
                    console.log("No outbox events found; waiting for next poll interval");
                    await delay(POLL_INTERVAL_MS, undefined, {
                        signal: abortController.signal
                    });
                }
            };
        } finally {
            await channel.close().catch(() => undefined);
            await connection.close().catch(() => undefined);
        }
    }

    async function runWithBackoff(): Promise<void> {
        let retryCount = 0;

        while (!abortController.signal.aborted) {
            const sessionStartTime = Date.now();
            try {
                await runSession();
            } catch {
                if (abortController.signal.aborted) {
                    break; // Exit the loop if the publisher is being stopped
                }

                // If the session fails, log a warning and retry with exponential backoff.
                console.warn(`Order outbox publisher session failed; retrying with backoff (attempt ${retryCount + 1})`);
                if (Date.now() - sessionStartTime >= MAX_BACKOFF_SECONDS * 1000) {
                    retryCount = 0; // Reset retry count if the session ran for a long time before failing
                }

                // Exponential backoff with a maximum wait time of MAX_BACKOFF_SECONDS.
                const backoffMs =
                    Math.min(2 ** Math.min(retryCount++, 6), MAX_BACKOFF_SECONDS) *
                    1_000;

                // Wait for the backoff period before retrying,
                // but allow the wait to be interrupted if the publisher is being stopped.
                try {
                    await delay(backoffMs, undefined, {
                        signal: abortController.signal
                    });
                } catch {
                    if (!abortController.signal.aborted) {
                        console.error("Error during backoff delay");
                        throw new Error("OUTBOX_RECONNECT_DELAY_FAILED");
                    }
                }
            }
        }
    }

    // Start the publisher in the background and return a function to stop it gracefully.
    const complete = runWithBackoff();

    return async () => {
        abortController.abort();
        await complete;
    }
}