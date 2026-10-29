import {
    creditReservationResultSchema,
} from "../schemas/credit-reservation-result.schema.js";
import {
    connectCreditReservationResultMessaging,
    CREDIT_RESERVATION_RESULT_MESSAGING,
    publishConfirmed,
} from "../libs/rabbitmq.js";
import { MAX_RESULT_BYTES } from "../workers/credit-reservation-result.consumer.js";

const usage =
    "Usage: npm run redrive:reservation-results -- --limit <positive integer>";

const routingKeys = {
    CREDIT_RESERVATION_SUCCEEDED:
        CREDIT_RESERVATION_RESULT_MESSAGING.routingKeys.CREDIT_RESERVATION_SUCCEEDED,
    CREDIT_RESERVATION_FAILED:
        CREDIT_RESERVATION_RESULT_MESSAGING.routingKeys.CREDIT_RESERVATION_FAILED,
} as const;

async function redrive(limit: number): Promise<void> {
    const { connection, channel } =
        await connectCreditReservationResultMessaging();

    try {
        const { messageCount } = await channel.checkQueue(
            CREDIT_RESERVATION_RESULT_MESSAGING.deadQueue,
        );
        const count = Math.min(limit, messageCount);
        let forwarded = 0;

        for (let index = 0; index < count; index++) {
            const message = await channel.get(
                CREDIT_RESERVATION_RESULT_MESSAGING.deadQueue,
                { noAck: false },
            );

            if (!message) break;

            let body: unknown;

            try {
                if (message.content.length > MAX_RESULT_BYTES) {
                    throw new Error("INVALID_EVENT");
                }

                body = JSON.parse(message.content.toString("utf8"));
            } catch {
                throw new Error("INVALID_EVENT");
            }

            const parsed = creditReservationResultSchema.safeParse(body);

            if (
                !parsed.success ||
                message.properties.messageId !== parsed.data.eventId
            ) {
                throw new Error("INVALID_EVENT");
            }

            const previousRedriveCount: unknown =
                message.properties.headers?.["x-redrive-count"] ?? 0;

            if (
                typeof previousRedriveCount !== "number" ||
                !Number.isSafeInteger(previousRedriveCount) ||
                previousRedriveCount < 0 ||
                previousRedriveCount >= Number.MAX_SAFE_INTEGER
            ) {
                throw new Error("INVALID_REDRIVE_COUNT");
            }

            await publishConfirmed(
                channel,
                CREDIT_RESERVATION_RESULT_MESSAGING.exchange,
                routingKeys[parsed.data.eventType],
                message.content,
                {
                    messageId: message.properties.messageId,
                    contentType:
                        message.properties.contentType ?? "application/json",
                    correlationId: message.properties.correlationId,
                    headers: {
                        ...message.properties.headers,
                        "x-retry-count": 0,
                        "x-redrive-count": previousRedriveCount + 1,
                        "x-redriven-at": new Date().toISOString(),
                    },
                },
            );

            channel.ack(message);
            forwarded++;

            console.info("Reservation result redrive", {
                eventId: parsed.data.eventId,
                correlationId: parsed.data.correlationId,
                requestType: parsed.data.requestType,
                orderId: parsed.data.orderId,
                redriveCount: previousRedriveCount + 1,
                outcome: "redriven",
            });
        }

        console.info("Reservation result redrive", {
            outcome: "complete",
            forwarded,
        });
    } finally {
        await channel.close().catch(() => undefined);
        await connection.close().catch(() => undefined);
    }
}

const args = process.argv.slice(2);

if (args.length === 1 && args[0] === "--help") {
    console.info(usage);
} else if (
    args.length !== 2 ||
    args[0] !== "--limit" ||
    !/^[1-9]\d*$/.test(args[1] ?? "") ||
    !Number.isSafeInteger(Number(args[1]))
) {
    console.error(usage);
    process.exitCode = 1;
} else {
    try {
        await redrive(Number(args[1]));
    } catch (error) {
        const reason =
            error instanceof Error &&
                ["INVALID_EVENT", "INVALID_REDRIVE_COUNT"].includes(error.message)
                ? error.message
                : "BROKER_OPERATION_FAILED";

        console.error("Reservation result redrive", {
            outcome: "stopped",
            reason,
        });
        process.exitCode = 1;
    }
}