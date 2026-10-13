import "dotenv/config";
import {
  connect,
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type Options,
} from "amqplib";

// Keep this topology identical in user-service and credit-service. Each service
// declares it independently so startup order does not affect message routing.
export const REGISTRATION_MESSAGING = {
  exchange: "foc.events",
  routingKey: "user.registered.v1",
  queue: "credit.user-registered.v1",
  retryQueue: "credit.user-registered.retry.v1",
  deadQueue: "credit.user-registered.dead.v1",
  retryDelayMs: 10_000,
} as const;

const BROKER_TIMEOUT_MS = 10_000;

export async function declareRegistrationTopology(channel: Channel): Promise<void> {
  const topology = REGISTRATION_MESSAGING;
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

/** Call from a background worker, never from registration or HTTP startup. */
export async function connectRegistrationMessaging(): Promise<{
  connection: ChannelModel;
  channel: ConfirmChannel;
}> {
  // Read lazily: missing broker configuration must not prevent HTTP startup.
  const value = process.env.RABBITMQ_URL;
  if (!value) throw new Error("RABBITMQ_URL is not configured");
  let url: URL;
  try {
    url = new URL(value);
    if (url.protocol !== "amqp:" && url.protocol !== "amqps:") throw new Error();
  } catch {
    throw new Error("RABBITMQ_URL must be an amqp:// or amqps:// URL");
  }
  if (!url.searchParams.has("heartbeat")) url.searchParams.set("heartbeat", "20");

  const connection = await connect(url.toString(), { timeout: BROKER_TIMEOUT_MS });
  // Handle EventEmitter errors even between operations; never log URL credentials.
  connection.on("error", () => console.warn("RabbitMQ connection error; reconnect required"));
  try {
    const channel = await connection.createConfirmChannel();
    channel.on("error", () => console.warn("RabbitMQ channel error; reconnect required"));
    await declareRegistrationTopology(channel);
    return { connection, channel };
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
}

const publishingChannels = new WeakSet<ConfirmChannel>();
const failedChannels = new WeakSet<ConfirmChannel>();

/**
 * One in-flight publish per dedicated channel makes returns unambiguous.
 * Resolve only after a positive confirm without a preceding mandatory return.
 * On failure, reconnect before publishing again; the outcome may be uncertain.
 */
export async function publishConfirmed(
  channel: ConfirmChannel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  properties: Options.Publish = {},
): Promise<void> {
  if (failedChannels.has(channel)) throw new Error("Reconnect before publishing again");
  if (publishingChannels.has(channel)) throw new Error("Concurrent publishes are not supported");
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
