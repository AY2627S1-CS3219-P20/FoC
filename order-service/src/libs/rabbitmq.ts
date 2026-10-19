import { OrderEventType } from "../generated/prisma/client.js";
import { connect, type Channel, type ChannelModel, type ConfirmChannel, type Options } from "amqplib";
import config from "../config/config.js";

export type SettlementOrderEventType = Extract<
    OrderEventType,
    "ORDER_RECEIVED" | "ORDER_CANCELED" | "ORDER_EXPIRED" | "ORDER_FAILED"
>;

const BROKER_TIMEOUT_MS = 10_000; // 10 seconds

export const ORDER_MESSAGING = {
    exchange: "foc.events",
    routingKey: "order.received.v1",
    routingKeys: {
        [OrderEventType.ORDER_RECEIVED]: "order.received.v1",
        [OrderEventType.ORDER_CANCELED]: "order.canceled.v1",
        [OrderEventType.ORDER_EXPIRED]: "order.expired.v1",
        [OrderEventType.ORDER_FAILED]: "order.failed.v1",
    } satisfies Record<SettlementOrderEventType, string>,
    queue: "credit.order-settlement.v1",
    retryQueue: "credit.order-settlement.retry.v1",
    deadQueue: "credit.order-settlement.dead.v1",
    retryDelayMs: 10_000,
} as const;

export async function declareOrderTopology(channel: Channel): Promise<void> {
    const topology = ORDER_MESSAGING;
    const queueOptions = {
        durable: true,
        autoDelete: false,
        arguments: {
            "x-queue-type": "quorum",
            "x-delivery-limit": -1,
            "x-overflow": "reject-publish",
        },
    };

    await channel.assertExchange(topology.exchange, "topic", {
        durable: true,
        autoDelete: false,
    });
    await channel.assertQueue(topology.queue, queueOptions);
    await channel.bindQueue(topology.queue, topology.exchange, topology.routingKey);
    await channel.assertQueue(topology.deadQueue, queueOptions);
    await channel.assertQueue(topology.retryQueue, {
        ...queueOptions,
        arguments: {
            ...queueOptions.arguments,
            "x-message-ttl": topology.retryDelayMs,
            "x-dead-letter-exchange": topology.exchange,
            "x-dead-letter-routing-key": topology.routingKey,
            // Retain expired retries until the destination confirms receipt.
            "x-dead-letter-strategy": "at-least-once",
        },
    });
    // Retry/dead queues are addressed by name using the default exchange ("").
}

export async function connectOrderMessaging(): Promise<{
    connection: ChannelModel;
    channel: ConfirmChannel;
}> {
    const value = config.rabbitmqUrl;
    let url: URL;
    try {
        url = new URL(value);
        if (url.protocol !== "amqp:" && url.protocol !== "amqps:") {
            throw new Error();
        }
    } catch {
        throw new Error("RABBITMQ_URL must be an amqp:// or amqps:// URL");
    }

    if (!url.searchParams.has("heartbeat")) {
        url.searchParams.set("heartbeat", "20");
    }

    const connection = await connect(url.toString(), {
        timeout: BROKER_TIMEOUT_MS
    });

    // Handle EventEmitter errors even between operations; never log URL credentials.
    connection.on("error", () =>
        console.warn("RabbitMQ connection error; reconnect required")
    );

    try {
        // Create a confirm channel for publishing messages with publisher confirms.
        const channel = await connection.createConfirmChannel();
        channel.on("error", () =>
            console.warn("RabbitMQ channel error; reconnect required")
        );

        // Assert the exchange for order events.
        await declareOrderTopology(channel);
        return { connection, channel };
    } catch (error) {
        await connection.close().catch(() => undefined);
        throw error;
    }
};

const publishingChannels = new WeakSet<ConfirmChannel>();
const failedChannels = new WeakSet<ConfirmChannel>();

export async function publishConfirmed(
    channel: ConfirmChannel,
    exchange: string,
    routingKey: string,
    content: Buffer,
    properties: Options.Publish = {},
): Promise<void> {
    if (failedChannels.has(channel)) {
        throw new Error("Reconnect before publishing again")
    };

    if (publishingChannels.has(channel)) {
        throw new Error("Concurrent publishes are not supported");
    }

    publishingChannels.add(channel);
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            channel.off("return", onReturn);
            channel.off("error", onError);
            channel.off("close", onClose);
            publishingChannels.delete(channel);

            if (error) {
                failedChannels.add(channel);
                // Prevent late confirms/returns from being mistaken for a new publish.
                void channel.close().catch(() => undefined);
                reject(error);
            } else {
                resolve();
            }
        };

        const onReturn = () => finish(new Error("RabbitMQ returned an unroutable message"));
        const onError = () => finish(new Error("RabbitMQ channel failed during publication"));
        const onClose = () => finish(new Error("RabbitMQ channel closed before confirmation"));
        const timer = setTimeout(
            () => finish(new Error("RabbitMQ publisher confirmation timed out")),
            BROKER_TIMEOUT_MS,
        );

        channel.on("return", onReturn);
        channel.on("error", onError);
        channel.on("close", onClose);

        try {
            // A false publish return is backpressure, not a negative confirmation.
            // Sequential callers wait here for broker confirmation before continuing.
            channel.publish(exchange, routingKey, content, {
                contentType: "application/json",
                ...properties,
                persistent: true,
                deliveryMode: 2,
                mandatory: true,
            }, (error) => {
                finish(error ? new Error("RabbitMQ did not confirm publication") : undefined);
            });
        } catch {
            finish(new Error("RabbitMQ publication failed"));
        }
    });
}

export function publishOrderEvent(
    channel: ConfirmChannel,
    eventType: SettlementOrderEventType,
    content: Buffer,
    properties: Options.Publish = {},
): Promise<void> {
    const routingKey = ORDER_MESSAGING.routingKeys[eventType];

    return publishConfirmed(
        channel,
        ORDER_MESSAGING.exchange,
        routingKey,
        content,
        properties,
    );
}