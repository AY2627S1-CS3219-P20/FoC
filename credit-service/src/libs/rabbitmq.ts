import "dotenv/config";
import {
  connect,
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type Options,
} from "amqplib";

const BROKER_TIMEOUT_MS = 10_000;

// --------------------- For user registration events ---------------------
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

export async function declareRegistrationTopology(
  channel: Channel
): Promise<void> {
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

// --------------------- For settlement events---------------------
export const SETTLEMENT_MESSAGING = {
  exchange: "foc.events",
  routingKey: "order.received.v1",
  routingKeys: {
    ORDER_RECEIVED: "order.received.v1",
    ORDER_CANCELED: "order.canceled.v1",
    ORDER_EXPIRED: "order.expired.v1",
    ORDER_FAILED: "order.failed.v1",
  },
  queue: "credit.order-settlement.v1",
  retryQueue: "credit.order-settlement.retry.v1",
  deadQueue: "credit.order-settlement.dead.v1",
  retryDelayMs: 10_000,
} as const;

export async function declareSettlementTopology(
  channel: Channel
): Promise<void> {
  const topology = SETTLEMENT_MESSAGING;
  const options = {
    durable: true,
    autoDelete: false,
    arguments: {
      "x-queue-type": "quorum",
      "x-delivery-limit": -1,
      "x-overflow": "reject-publish",
    }
  };
  await channel.assertExchange(topology.exchange, "topic", {
    durable: true, autoDelete: false
  });
  await channel.assertQueue(topology.queue, options);
  for (const routingKey of Object.values(topology.routingKeys)) {
    await channel.bindQueue(topology.queue, topology.exchange, routingKey);
  }
  await channel.assertQueue(topology.deadQueue, options);
  await channel.assertQueue(topology.retryQueue, {
    ...options, arguments: {
      ...options.arguments,
      "x-message-ttl": topology.retryDelayMs,
      "x-dead-letter-exchange": topology.exchange,
      "x-dead-letter-routing-key": topology.routingKey,
      "x-dead-letter-strategy": "at-least-once",
    }
  });
}

// --------------------- For reservation request events ---------------------
export const RESERVATION_REQUEST_MESSAGING = {
  exchange: "foc.events",
  routingKey: "credit.reservation.requested.v1",
  queue: "credit.order-reservation-requests.v1",
  retryQueue: "credit.order-reservation-requests.retry.v1",
  deadQueue: "credit.order-reservation-requests.dead.v1",
  retryDelayMs: 10_000,
} as const;

export async function declareReservationRequestTopology(
  channel: Channel,
): Promise<void> {
  const topology = RESERVATION_REQUEST_MESSAGING;
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
  await channel.bindQueue(
    topology.queue,
    topology.exchange,
    topology.routingKey,
  );

  // The consumer forwards retries and dead-lettered messages to these queues
  // through RabbitMQ's default exchange.
  await channel.assertQueue(topology.deadQueue, queueOptions);
  await channel.assertQueue(topology.retryQueue, {
    ...queueOptions,
    arguments: {
      ...queueOptions.arguments,
      "x-message-ttl": topology.retryDelayMs,
      "x-dead-letter-exchange": topology.exchange,
      "x-dead-letter-routing-key": topology.routingKey,
      "x-dead-letter-strategy": "at-least-once",
    },
  });
}


/** Call from a background worker, never from registration or HTTP startup. */
async function connectMessaging(declareTopology: (channel: Channel) => Promise<void>): Promise<{
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
    await declareTopology(channel);
    return { connection, channel };
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
}

export function connectRegistrationMessaging() {
  return connectMessaging(declareRegistrationTopology);
}

export function connectSettlementMessaging() {
  return connectMessaging(declareSettlementTopology);
}

export function connectReservationRequestMessaging() {
  return connectMessaging(declareReservationRequestTopology);
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


// --------------------- For reservation result events ---------------------
export const RESERVATION_RESULT_MESSAGING = {
  exchange: "foc.events",
  routingKeys: {
    succeeded: "credit.reservation.succeeded.v1",
    failed: "credit.reservation.failed.v1",
  },
} as const;

export async function declareReservationResultTopology(
  channel: Channel,
): Promise<void> {
  await channel.assertExchange(
    RESERVATION_RESULT_MESSAGING.exchange,
    "topic",
    { durable: true, autoDelete: false },
  );
}

export function connectReservationResultMessaging() {
  return connectMessaging(declareReservationResultTopology);
}

export type ReservationResultKind =
  keyof typeof RESERVATION_RESULT_MESSAGING.routingKeys;

export function publishReservationResult(
  channel: ConfirmChannel,
  kind: ReservationResultKind,
  content: Buffer,
  properties: Options.Publish = {},
): Promise<void> {
  return publishConfirmed(
    channel,
    RESERVATION_RESULT_MESSAGING.exchange,
    RESERVATION_RESULT_MESSAGING.routingKeys[kind],
    content,
    properties,
  );
}