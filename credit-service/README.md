# Credit service

Credit-service manages student credits using PostgreSQL and Prisma. It stores current balances in `CreditAccount` and records each change in `CreditTransaction`. These transaction records can only be added, never edited or deleted. Current balances are stored directly; this is not full event sourcing.

The service supports:

- Giving a newly registered student their initial credits once, even if RabbitMQ delivers the registration event more than once. User-service saves the event in its outbox as part of registration.
- Letting authenticated students read their balance and transaction history for the navbar and history page.
- Holding credits for an order and returning a hold when order creation is abandoned (F4). These APIs are for trusted Order Service calls.
- Processing order events to pay a courier after receipt (F5), release a hold after cancellation or expiry (F6), or refund a hold after failure (F7).

Order Service still needs the code that calls Credit and publishes order events. The complete workflow across both services has not been verified.

## Setup

Use Node.js compatible with the installed Prisma package (`^20.19 || ^22.12 || >=24.0`), npm, and a PostgreSQL database dedicated to credit-service.

From the repository root:

```sh
cd credit-service
npm ci
```

If `.env` does not already exist, copy `.env.example` to `.env`. Configure:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL for the credit database; configure SSL for your database environment. |
| `RABBITMQ_URL` | AMQP connection URL; local default `amqp://foc:foc-local-only@localhost:5672?heartbeat=20`. |
| `PORT` | HTTP port, for example `3003`. |
| `FRONTEND_URL` | Allowed frontend origin, for example `http://localhost:5173`. |
| `ORDER_CREDIT_SERVICE_TOKEN` | Shared secret for internal Order → Credit requests. Missing configuration denies all internal requests. |
| `JWT_PUBLIC_KEY_PATH` | Path to the PEM public key matching user-service's RS256 signing key. Relative paths resolve from the process working directory. |

The Prisma CLI needs `DATABASE_URL`. The application and shared Prisma-client module load all application settings. Starting the HTTP server also reads the JWT public-key file. Keep credentials and key files out of Git.

Apply the checked-in migrations, generate the client, and build:

```sh
npm run db:deploy
npm run db:generate
npm run build
```

Start development with `npm run dev`, or run the compiled application with `npm start`.

The registration consumer starts after the HTTP server begins listening. It reconnects if RabbitMQ becomes unavailable. `GET /credits` only confirms that the HTTP server is running; it does not check RabbitMQ or whether students have received credits.

Authenticated read endpoints are under `/api/credits/me`. There is no public endpoint for granting credits.

## RabbitMQ and service startup

RabbitMQ runs in Docker; no native RabbitMQ installation is needed. Start Docker Desktop/the Docker engine first. From the repository root:

```sh
docker compose config --quiet
docker compose up -d rabbitmq
docker compose ps
docker compose logs --tail=50 rabbitmq
```

If macOS reports `docker: command not found` and Docker Desktop installed its CLI under `~/.docker/bin`, run `export PATH="$HOME/.docker/bin:$PATH"` in your terminal. Add that export to `~/.zshrc` to keep it for new shells.

Compose downloads `rabbitmq:4.2-management` and stores broker data in a named volume. Both ports are bound to localhost:

- AMQP: `5672`
- Management UI: `15672`, at <http://localhost:15672>

The development login is `foc` / `foc-local-only`. Override it using `RABBITMQ_USER` and `RABBITMQ_PASSWORD` in the **root** `.env`. These settings create users when the broker volume is first initialized. Changing them later does not update existing broker users.

Set `RABBITMQ_URL` in **both service directories'** `.env` files using the same credentials. URL-encode any special characters in the credentials.

Services running on your host use `localhost`. A future service running in a container on the same Compose network would use `rabbitmq`. Host service processes do not automatically load the root `.env`.

Apply migrations and generate clients in each service before startup:

```sh
(cd user-service && npm ci && npm run db:deploy && npm run db:generate && npm run build)
(cd credit-service && npm ci && npm run db:deploy && npm run db:generate && npm run build)
```

Run `npm start` from each service directory in separate terminals, or use `npm run dev`. The user-service publisher and credit-service consumer run inside those processes; you do not need separate worker commands.

Either service can start first. Each connection sets up the required exchanges, queues and bindings before processing messages. The HTTP servers can start while RabbitMQ is down.

Stop services with Ctrl+C. They try to finish work already in progress before a 15-second shutdown deadline.

Use `docker compose stop rabbitmq` to stop the broker and `docker compose start rabbitmq` to restart it. These commands and ordinary `docker compose down` preserve the volume. **`docker compose down -v` deletes broker data.**

This local setup uses one broker node. Data survives restarts, but the setup does not provide high availability or recovery from permanent volume loss.

## Registration delivery contract

User-service sends this registration event in an AMQP message. The initial credit amount is fixed by Credit; the event does not choose it.

```json
{
  "eventId": "4c32dd25-ae56-4adc-92fb-a8a663b82957",
  "eventType": "USER_REGISTERED",
  "eventVersion": 1,
  "occurredAt": "2026-10-12T00:00:00.000Z",
  "userId": "f71dc4c3-af70-47db-adc5-d547c0781a91",
  "role": "STUDENT"
}
```

The consumer requires exactly these fields. UUIDs must be valid, the timestamp must be UTC ISO format ending in `Z`, and AMQP `messageId` must equal `eventId`. Do not include email, passwords or grant amounts.

Credit trusts the publisher to report verified student registrations. It does not ask user-service to check eligibility, so restrict who can publish to the broker.

| Component | Declaration |
| --- | --- |
| Exchange | Durable topic exchange `foc.events` |
| Registration route | `user.registered.v1` → `credit.user-registered.v1` |
| Retry queue | `credit.user-registered.retry.v1`, 10-second TTL, dead-letter route back to the registration exchange/key |
| Dead-letter queue | `credit.user-registered.dead.v1`, no TTL |

All three queues are durable quorum queues. They use `reject-publish` when full and disable automatic delivery-count limits. The retry queue uses at-least-once dead-lettering, which can deliver the same message more than once. Retry and dead-letter messages are sent to queue names through the default exchange.

Both services define the same exchanges, queues and bindings in `src/libs/rabbitmq.ts`. Update both files together when changing the contract.

Publishers send persistent messages, require successful routing, and wait up to 10 seconds for broker confirmation. A returned message still counts as a routing failure, even if the broker also confirms it. Confirmation means RabbitMQ accepted the message; it does not mean Credit has granted the credits yet.

The consumer processes one message at a time (`prefetch: 1`). It acknowledges the message only after the grant function succeeds, including when the grant already exists.

Temporary database connection failures, timeouts and transaction conflicts get up to five delayed retries after the first attempt, for six processing attempts in total. `x-retry-count` starts at zero and increases with each scheduled retry. The retry queue waits at least 10 seconds; outages or a backlog can make the wait longer.

Invalid or unsupported events, invalid retry metadata, permanent failures (including `CREDIT_ACCOUNT_INCONSISTENT`), and messages that use up their retries go to the dead-letter queue for investigation.

The consumer waits for confirmation before acknowledging a message moved to a retry or dead-letter queue. If forwarding fails, it leaves the original unacknowledged and reconnects. The wait between reconnect attempts grows to at most 60 seconds.

Lost confirmations or acknowledgments can cause extra deliveries beyond the scheduled retry count. The initial-grant function prevents these deliveries from granting credits again.

## Inspecting and redriving dead letters

From the repository root, inspect ready and unacknowledged messages without consuming them:

```sh
docker compose exec rabbitmq rabbitmqctl list_queues -p / name messages_ready messages_unacknowledged consumers
```

Look for `credit.user-registered.dead.v1`. The management UI also shows message counts and queue settings. Consumer logs include valid event and user IDs, the attempt, the outcome, and a failure reason with a length limit.

When inspecting messages, avoid a "get messages" operation that acknowledges and removes them. For counts and ages of unpublished outbox events, see [user-service operations](../user-service/README.md#credit-provisioning-outbox).

After resolving the original failure, stop credit-service while keeping RabbitMQ running, then from `credit-service`:

```sh
npm run redrive -- --limit 10
```

For a compiled deployment:

```sh
npm run redrive:prod -- --limit 10
```

Redrive means sending a dead-letter message back for another processing attempt. The command only needs `RABBITMQ_URL`; it does not start Prisma or the HTTP server.

Restart credit-service afterward. Keeping its consumer paused during redrive prevents a still-failing event from returning to the dead-letter queue and being picked up again in the same run. Run one redrive command at a time.

The command processes the oldest available dead letters. It stops at the requested positive limit or the number of ready messages counted at startup, whichever is smaller.

For each message, it:

- Preserves the exact event bytes, event ID, occurrence time and message ID.
- Resets `x-retry-count` to zero, increments `x-redrive-count`, and sets `x-redriven-at`.
- Keeps failure and death headers for diagnosis, but drops message expiration and AMQP user identity.
- Acknowledges the dead letter only after RabbitMQ confirms republication to the registration route.

A broker failure stops the command with exit code 1. The current unacknowledged message becomes available again when the connection closes. Invalid event bodies, identities or redrive counts also stop the command without removing the message. Investigate these separately; redrive does not rewrite events or repair accounts.

A crash after forwarding but before acknowledgment can create a duplicate delivery. The grant function still prevents a second grant. A successful redrive means the message was republished; Credit may not have processed it yet.

`npm run redrive -- --help` displays usage without contacting the broker.

## Migration contract

Deploy `20261012000000_add_credit_transaction_ledger` before using the grant function. `npm run db:deploy` applies pending migrations, including the original account migration on a fresh database. Client generation is a separate step.

The ledger migration runs in a transaction. It adds constraints, the transaction enum and table, indexes, and rules that prevent editing or deleting ledger entries. It does not create accounts, change balances or grant credits to existing users.

If existing balances are negative, the migration fails. Investigate and correct that data explicitly. Do not silently reset balances or grant credits to work around the failure. Follow Prisma's failed-migration recovery process before retrying deployment.

Database invariants:

- `availableCredits` and `reservedCredits` are non-negative integers.
- Transaction `amount` is a positive integer; `availableDelta` and `reservedDelta` are signed integers.
- `idempotencyKey` is unique across the ledger.
- A SQL partial unique index permits at most one `INITIAL_ALLOCATION` per account.
- A PostgreSQL trigger rejects ledger `UPDATE`, `DELETE`, and `TRUNCATE` statements. Corrections require new entries; no correction workflow is implemented.
- The local account foreign key uses `ON DELETE RESTRICT ON UPDATE RESTRICT`. Ledger records cannot be cascaded away with an account.

Migration SQL defines the checks, partial unique index, and trigger/function. Preserve these in future migrations; the Prisma schema does not describe all of them.

- Use `npm run db:migrate -- --name <change_name>` to create migrations against a development database, then review the SQL.
- Deploy using the checked-in migrations. Do not substitute `prisma db push`.
- `npm run db:reset` destroys database data. Do not use it to upgrade a database.

`CreditAccount.userId` and nullable `CreditTransaction.orderId` are external UUID references owned by user-service and order-service. They have no cross-service foreign keys or joins. Account and transaction IDs are local UUIDs, and transaction timestamps use `TIMESTAMPTZ(6)`.

## Initial-grant function

Exported from `src/services/credit.service.ts`:

```ts
grantInitialCredits(
    prisma: PrismaClient,
    userId: string,
): Promise<InitialCreditGrantResult>

interface InitialCreditGrantResult {
    account: CreditAccount;
    transaction: CreditTransaction;
    created: boolean;
}
```

Pass a full Prisma client; the function owns its transaction. For example, code under `src/` can call:

```ts
import { prisma } from "./libs/prisma.js";
import { grantInitialCredits } from "./services/credit.service.js";

// Eligibility and event validation must already have succeeded.
const result = await grantInitialCredits(prisma, verifiedStudentUserId);
```

The function validates `userId` with Zod's UUID validator and normalizes it to lowercase. Its deterministic idempotency key is `initial-allocation:<normalized-userId>`.

On first provisioning, one database transaction creates:

| Record | Values |
| --- | --- |
| Account | `availableCredits: 50`, `reservedCredits: 0` |
| Initial transaction | `type: INITIAL_ALLOCATION`, `amount: 50`, `availableDelta: 50`, `reservedDelta: 0`, `orderId: null` |

Both writes succeed together or are rolled back together. The first successful call returns `created: true`.

Repeated calls, including simultaneous calls for the same user, return the existing account and original grant with `created: false`. Any failed account-creation transaction is rolled back first. These calls do not add credits or reset balances, even if later activity has changed the balance.

An existing account must have exactly one initial-allocation record matching the deterministic key, amount, deltas, and null order ID. The function does not repair an account lacking that record or having an incompatible record.

| Failure | Contract |
| --- | --- |
| Invalid UUID | `AppError` with code `INVALID_USER_ID`, status `400`; no database writes. |
| Missing or incompatible grant on an existing account | `AppError` with code `CREDIT_ACCOUNT_INCONSISTENT`, status `500`; investigate without automatic repair. |
| Other database/transaction failure | Error propagates. Writes in the failed provisioning transaction roll back. |

These statuses describe errors from the function; there is no public HTTP grant API. If a connection fails, the caller may not know whether the transaction committed. Retrying with the same user ID is safe.

## Access and provisioning boundaries

- Call the internal function only for newly verified students. The caller must check eligibility; the function does not query user-service or check role and verification state. Do not use it to give all existing users credits during a migration or startup.
- User-service saves the new user and its provisioning outbox event in the same transaction. Registration can succeed before Credit creates the account. A missing account means provisioning is pending, not that the student has a zero balance.
- Acknowledge delivery after the function succeeds, including `created: false`. Redelivery after a lost acknowledgment is safe. Retry temporary database failures. Investigate invalid IDs and `CREDIT_ACCOUNT_INCONSISTENT` errors instead of granting again or resetting balances.
- Only students can read balances and history. Promoting a student to admin keeps their credit records. Access checks use the role in the verified JWT; they do not query user-service or revoke existing student tokens after promotion.
- Save each balance change and its transaction entries together. Show available and reserved balances separately. Available credits are already spendable, so do not subtract reserved credits again.

## Credit read API contract

Both endpoints require `Authorization: Bearer <access-token>`. Tokens must verify using RS256 and contain a UUID `userId`, a string `email`, and a recognized role. Only `STUDENT` is authorized; valid `ADMIN` tokens receive 403, including when an account exists from before promotion.

Both endpoints select the account using only the verified JWT user ID. They do not accept account or user IDs in the path, query or body. Send GET requests without bodies.

Reading a balance or history never creates an account, grants credits or changes the ledger.

### Exact response types

Frontend consumers receive these JSON types. Backend definitions are in `src/types/credit.types.ts`; transaction-type values come from the Prisma enum.

```ts
type CreditTransactionType =
  | "INITIAL_ALLOCATION"
  | "RESERVATION"
  | "TRANSFER_SENT"
  | "TRANSFER_RECEIVED"
  | "RELEASE"
  | "REFUND";

type ProvisioningResponse = {
  success: true;
  data: { status: "PROVISIONING" };
};

type BalanceReadyResponse = {
  success: true;
  data: {
    status: "READY";
    availableCredits: number;
    reservedCredits: number;
    updatedAt: string;
  };
};

type CreditTransactionItem = {
  id: string;
  type: CreditTransactionType;
  amount: number;
  availableDelta: number;
  reservedDelta: number;
  createdAt: string;
  orderId: string | null;
};

type TransactionsReadyResponse = {
  success: true;
  data: {
    status: "READY";
    items: CreditTransactionItem[];
    nextCursor: string | null;
  };
};

type BalanceResponse = BalanceReadyResponse | ProvisioningResponse;
type TransactionsResponse = TransactionsReadyResponse | ProvisioningResponse;

type CreditErrorResponse = {
  success: false;
  code: string;
  message: string;
};
```

- READY responses use HTTP 200. PROVISIONING responses use HTTP 202.
- Errors contain the error fields shown above and no `data` field.
- Every field shown for a response type is required. `orderId` is always included, even when `null`.
- IDs are UUID strings. Timestamps are UTC ISO strings with milliseconds and a trailing `Z`.
- Balances are non-negative integers. Transaction amounts are positive integers; deltas can be positive, negative or zero.
- Transaction items do not expose account IDs, user IDs or idempotency keys.

### Balance endpoint

```http
GET /api/credits/me/balance
Authorization: Bearer <access-token>
```

This endpoint accepts no query parameters. A provisioned account returns HTTP 200:

```json
{
  "success": true,
  "data": {
    "status": "READY",
    "availableCredits": 50,
    "reservedCredits": 0,
    "updatedAt": "2026-10-12T00:00:00.000Z"
  }
}
```

Display available and reserved credits separately. Available credits are already spendable; do not subtract reserved credits again. Zero balances are valid READY values. `updatedAt` is the account's stored update time, not the request time.

### Provisioning (both endpoints)

When an account lookup succeeds but no account exists, either endpoint returns HTTP 202:

```json
{
  "success": true,
  "data": {
    "status": "PROVISIONING"
  }
}
```

This response means the account is missing. It contains no numeric balances, timestamps, items or cursor. Do not display it as a zero balance or empty history. A database failure returns an error instead.

Axios treats 202 as success. Check `response.data.data.status` before reading READY fields.

An older user without a credit account also gets PROVISIONING. Reading the endpoint does not create the account, and the response does not guarantee that an account will eventually be created. The API supplies no polling interval or completion deadline. Offer a refresh/retry action; repeated 202 responses still mean provisioning is incomplete.

### Transaction-history endpoint

```http
GET /api/credits/me/transactions?type=INITIAL_ALLOCATION&sort=desc&limit=20
Authorization: Bearer <access-token>
```

| Query parameter | Accepted value | When omitted |
| --- | --- | --- |
| `type` | One exact, case-sensitive `CreditTransactionType` value | All types |
| `sort` | `asc` or `desc` | `desc` |
| `limit` | Digits representing an integer from 1 through 100 | `20` |
| `cursor` | Nonempty opaque token returned by the API, at most 1,024 characters | First page |

Invalid query parameters return 400. This includes unknown or repeated parameters, arrays, empty values, unsupported enum values, and invalid limits. Limits must contain digits only, with no signs, spaces, decimal points or exponent notation.

Leave optional parameters out when unused. Do not send `type=ALL`, `cursor=null`, or empty strings.

History only includes the authenticated student's account, even when filters are used. All credit operations write to the same ledger: initial allocation, reservation, release after abandoned creation, F5 receipt transfers (`TRANSFER_SENT` and `TRANSFER_RECEIVED`), F6 cancellation/expiry (`RELEASE`), and F7 failure (`REFUND`).

HTTP 200 example with one transaction and no further page:

```json
{
  "success": true,
  "data": {
    "status": "READY",
    "items": [
      {
        "id": "f6cef655-f9a9-4819-bce9-71261870fab0",
        "type": "INITIAL_ALLOCATION",
        "amount": 50,
        "availableDelta": 50,
        "reservedDelta": 0,
        "createdAt": "2026-10-12T00:00:00.000Z",
        "orderId": null
      }
    ],
    "nextCursor": null
  }
}
```

An existing account with no matching transactions returns HTTP 200:

```json
{
  "success": true,
  "data": { "status": "READY", "items": [], "nextCursor": null }
}
```

`amount` is always positive. Use `availableDelta` and `reservedDelta` to show whether each balance increased or decreased.

### Sorting and pagination

The default order is `createdAt DESC, id DESC`. With `sort=asc`, it is `createdAt ASC, id ASC`. The transaction ID breaks ties when stored timestamps are equal.

Keep the API's order in the UI. PostgreSQL stores microseconds, but response timestamps do not include that full precision. Sorting the response again can change the intended order.

Each page has at most `limit` items. If another row exists, `nextCursor` contains a token for the next page. Otherwise it is `null`.

A cursor belongs to one account, type filter (including no filter), and sort direction. It must point to an existing transaction within those settings. Invalid or incompatible cursors return 400. Pass the token back unchanged; do not decode, edit or create cursors in the frontend. The server checks account access separately from cursor content.

Keep type and sort unchanged between pages. Reset the list and cursor when either changes. You may change `limit` between pages.

The server checks query syntax and cursor structure before looking up the account. It checks whether the cursor matches the account only after finding that account. A request with valid syntax and cursor structure returns 202 if the account is missing.

Example consuming a first page and, when available, a second page using the service's Axios client:

```ts
// creditApi uses the credit-service origin as its baseURL and the existing
// bearer-token/refresh interceptors. These paths include /api/credits.
const params = { sort: "desc", limit: 20 } as const; // all transaction types
const first = await creditApi.get<TransactionsResponse>(
  "/api/credits/me/transactions", { params },
);

if (first.data.data.status === "READY") {
  const items = [...first.data.data.items];
  const cursor = first.data.data.nextCursor;
  if (cursor !== null) {
    const second = await creditApi.get<TransactionsResponse>(
      "/api/credits/me/transactions",
      { params: { ...params, cursor } }, // Axios URL-encodes the returned token
    );
    if (second.data.data.status === "READY") {
      items.push(...second.data.data.items);
      // Retain second.data.data.nextCursor for the next load-more action.
    }
  }
  // Render items in their returned order; handle PROVISIONING separately.
}
```

Pages read live data, so new transactions can arrive while the user browses. Refresh the first page to see new rows before the current cursor. New rows after it may appear on later pages. Page length does not tell you the total transaction count.

Existing indexes on `(accountId, createdAt DESC, id DESC)` and `(accountId, type, createdAt DESC, id DESC)` support these reads. No new migration is required.

### Errors and frontend handling

| HTTP | `code` | `message` | Meaning |
| --- | --- | --- | --- |
| 400 | `BAD_REQUEST` | `Invalid query parameters` | Unsupported/invalid query fields, including empty or oversized cursor parameters |
| 400 | `BAD_REQUEST` | `Invalid cursor` | Cursor decoding, schema, scope, or anchor validation failed |
| 401 | `AUTHENTICATION_REQUIRED` | `Authentication required` | Missing/empty bearer authentication or unsupported authorization scheme |
| 401 | `UNAUTHORIZED` | `Invalid token, please sign out and back in` | Invalid/expired token, signature, or required claims |
| 403 | `FORBIDDEN` | `You do not have permission to access this resource` | Valid admin token cannot access credit reads |
| 500 | `INTERNAL_SERVER_ERROR` | `An unexpected error occurred` | Unexpected failure, including database errors |

Example HTTP 400:

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "Invalid cursor"
}
```

- Hide credit UI for admins.
- Use the existing authentication refresh handling for 401 responses.
- Show 403 and 500 as errors, not as provisioning, zero balance or empty history.
- On a cursor error, offer to restart from the first page.
- Show READY with no items, PROVISIONING, and request errors as separate states. Ignore stale page responses after the user changes filters or sort.

## Validation

```sh
npx prisma validate
npm run db:generate
npm run build
```

Run input/authentication/retry tests with `npm test`. Run PostgreSQL integration tests with:

```sh
CREDIT_TEST_DATABASE_URL="postgresql://username:password@localhost:5432/credit_test" npm run test:integration
```

Use a dedicated test database, never production. The database role needs permission to create schemas.

The suite creates a schema with a random name, applies all checked-in migrations, then drops only that schema. If the integration URL is missing, the database suite is skipped.

Previously reported local checks: Prisma client generation, the TypeScript application build, and PostgreSQL integration tests (30 passed, one live-broker test skipped). The suite covers historical abort tombstones, Credit-generated IDs, repeated and simultaneous holds for the same order, insufficient credits, balance overflow, rollback, repeated aborts, HTTP contracts, and independent settlement of each reservation.

These results do not verify full Order creation/recovery, live-broker behavior for this change, or browser E2E.

## Internal F4 reservation API

These routes require `Authorization: Bearer <ORDER_CREDIT_SERVICE_TOKEN>`. A student JWT cannot access them.

Keep `/internal/credits` private and use HTTPS between deployed services. The service reads the token from the environment for each request and never returns or logs it.

| Method/path | Purpose |
| --- | --- |
| `POST /internal/credits/reservations` | Create a new hold with a Credit-generated ID. |
| `GET /internal/credits/reservations/:reservationId` | Read a reservation using Credit's returned ID. |
| `POST /internal/credits/reservations/:reservationId/abort` | Return held credits when order creation is abandoned. |

Reserve accepts exactly these fields:

```json
{
  "orderId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6482",
  "requesterId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6483",
  "amount": 10
}
```

Credit generates the reservation UUID and returns it as `data.id`. Order does not generate it. The reserve API rejects caller-supplied reservation IDs and request keys.

Every successful reserve call creates a new hold and returns 201, even if the same request was already sent. **Retrying after a lost response can create another hold.** Save Credit's returned ID; the current API still requires it for lookup, abort and settlement.

UUIDs are converted to lowercase. Amounts must be integers from 1 through 2,147,483,647. Successful responses use `{ success: true, data: <reservation> }`. Lookup and abort return 200.

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid request body |
| 404 | Account or reservation not found |
| 409 | Insufficient credits or an invalid lifecycle transition |
| 503 | Temporary database failure |

To abort, send the same order, requester and amount, plus `reservationId`. The ID must match the path and refer to an existing reservation. Repeating an abort returns the same ABORTED state without returning credits twice.

A missing reservation returns 404. Abort does not create a placeholder record, also called a tombstone. Only abort when order creation is durably known to be abandoned; use the normal cancellation flow for an existing order.

### Multiple reservations per order

One `orderId` can have several active or historical reservations. Each has its own Credit-generated ID and deducts its own amount from available credits.

For example, starting with 50 credits and creating holds of 10 and 15 leaves 25 available and 25 reserved. Aborting or settling one hold leaves the other hold unchanged.

Credit does not automatically settle all holds for an order. Each settlement event must name one returned `reservationId`, that hold's amount, and a distinct `eventId`.

Reservation, balance and ledger changes are saved in the same transaction. Abort returns the held credits and records one RELEASE transaction. Credit prevents duplicate ledger entries and repeated settlement, but the reserve API has no key for recognizing duplicate requests.

### Migration and caller changes

Run `npm run db:deploy` and `npm run db:generate` before starting the updated service.

On a fresh database, `20261012010000_add_reservations` allows multiple active reservations per order. It has no unique index limiting an order to one active hold.

If a local or staging database already applied an older version of this migration, its schema and migration history need to be reconciled before deployment. Editing the migration file does not update an existing database.

Update callers at the same time as this deployment: leave out the old `reservationId` field when reserving, then save Credit's returned `data.id`. Lookup, abort and settlement still use that ID. The Order Service caller is not implemented yet.

## F5 to F7: receipt, release and failure settlement

Settlement means paying out or returning a reservation. Credit handles these v1 events on `foc.events`:

| Event | Routing key | Result |
| --- | --- | --- |
| `ORDER_RECEIVED` | `order.received.v1` | Pay the courier (F5) |
| `ORDER_CANCELED` | `order.canceled.v1` | Return held credits to the requester (F6) |
| `ORDER_EXPIRED` | `order.expired.v1` | Return held credits to the requester (F6) |
| `ORDER_FAILED` | `order.failed.v1` | Refund held credits to the requester (F7) |

`ORDER_COMPLETED` does not pay the courier. There is no browser-facing transfer endpoint.

Order must check receipt permission and save the valid status change and outbox event in one transaction. The Order event producer and outbox publisher are still pending.

### Event format

Publish persistent JSON, require successful routing, and wait for broker confirmation. `messageId` must equal the lowercase `eventId` (the original outbox UUID). Keep that identity and every event field unchanged on retries:

```json
{
  "eventId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6490",
  "eventType": "ORDER_RECEIVED",
  "orderId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6482",
  "reservationId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6481",
  "requesterId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6483",
  "courierId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6484",
  "amount": 10
}
```

All fields are required for receipt. For cancellation, expiry or failure, use the matching eventType and **omit courierId**. Extra fields are rejected.

Settlement events no longer include eventVersion, orderVersion, orderName or occurredAt. Old-format messages are rejected, and removing those fields from a replay will not match a previously stored old-format settlementPayload.

Validation rules:

- Maximum body size: 64 KiB.
- UUIDs are converted to lowercase.
- amount must be a positive PostgreSQL Int.
- Requester and courier must be different users.

Credit stores the complete validated event. An identical repeat is safe, but a repeat with changed fields is rejected, including changes to eventId, eventType, courierId or amount.

### Receipt: pay the courier (F5)

Credit uses one Serializable transaction, which protects concurrent balance changes, to:

1. Find the exact reservation and check its order, requester and amount.
2. Change its state from RESERVED to TRANSFERRED.
3. Move the stored amount from the requester's reserved credits to the courier's available credits.
4. Write both ledger entries and save RECEIVED, the courier, event identity, full event and settledAt.

Both accounts must already exist; transfers never create accounts. The whole transaction rolls back if the reserved balance is too small, an account is inconsistent, the courier balance would exceed the Int limit, the event ID was used for another reservation cycle, or the reservation already has a different final outcome.

An identical repeat changes nothing. Credit makes at most three local attempts for serialization or deadlock conflicts before using delayed retry. Payment happens asynchronously after Order records receipt.

### Cancellation and expiry: release a hold (F6)

Credit changes RESERVED to RELEASED and moves the stored amount from requester reserved credits back to available credits. It adds one `RELEASE` row with available/reserved deltas +amount/−amount. The CANCELED/EXPIRED reason, event identity, full event and settledAt are saved in the same transaction.

No courier account is needed. If the available balance would overflow or the reserved balance is inconsistent, the transaction rolls back.

Repeating the identical event changes nothing. Credit rejects a changed repeat, receipt after release, or release after transfer or abort. An old expiry event only targets its own reservation ID, so it cannot release a renewed hold.

### Failure: refund a hold (F7)

For `ORDER_FAILED`, Credit changes RESERVED to REFUNDED and returns the held amount to the requester. It adds one `REFUND` row with available/reserved deltas +amount/−amount. The FAILED reason, event identity, full event and settledAt are saved in the same transaction.

The same duplicate-event and balance checks as F6 apply. No courier account is needed. Refunds after transfer, release or abort are rejected. This operation only returns held credits; it cannot reclaim credits already paid to a courier.

### Order Service responsibilities

The Order producers are still pending. Order must:

- Authorize cancellation or expiry, then save OPEN → CANCELED/EXPIRED together with its version, status history and outbox event.
- Protect COMPLETED → FAILED against competing manual or automatic receipt, then save the failure change and outbox event together.

Credit's consumer does not complete Order's lifecycle workflow. After cancellation, expiry or failure, credits may remain unavailable until the event is delivered and processed.

### Queues and retries

Settlement uses three separate durable quorum queues:

- `credit.order-settlement.v1`: incoming events.
- `credit.order-settlement.retry.v1`: delayed retries.
- `credit.order-settlement.dead.v1`: events needing investigation, also called the dead-letter queue or DLQ.

All four F5 to F7 routes are bound. Registration queues and bindings are unchanged.

The retry queue has a 10-second TTL, rejects publishing when full, and uses at-least-once dead-lettering back to the existing receipt route. Retry forwarding waits for confirmation and keeps the original route in `x-settlement-routing-key`. The consumer checks that header against eventType for delayed retries. This preserves the existing durable queue settings without deleting queues. Redrive uses the event's own route.

Missing accounts or reservations, or conflicts that use up the local serialization attempts, get at most five delayed retries: six processing attempts in total. Invalid messages and conflicts go straight to the DLQ. Dead letters have no TTL.

A database outage closes the consumer session. Reconnect waits grow from 1 to 60 seconds without increasing the event's retry count. Before acknowledging an original message, retry/DLQ forwarding must be confirmed and successfully routed.

The settlement consumer starts alongside registration after the HTTP server begins listening. It processes one message at a time (prefetch 1) and stops before Prisma disconnects. Settlement needs no additional environment variables or migration.

### Replay settlement dead letters

Inspect the DLQ and fix the underlying cause first. Then replay valid original events:

```sh
npm run redrive:settlement -- --limit 10
```

The command stops at its limit. It preserves the body and event/message identity, resets the retry count, and increments the redrive count. It acknowledges a DLQ message only after confirmed routing, then closes the channel before the connection so pending acknowledgments are sent.

Invalid events stop the run and stay queued. Investigate conflicting final outcomes; replay cannot overwrite an already settled reservation.

Never edit balances, replace event IDs, purge queues or delete broker volumes to recover held funds. Deployed services need a private broker, a dedicated virtual host, restricted publisher/consumer credentials, and TLS.

### Broker integration checks

Run optional broker checks together with PostgreSQL tests:

```sh
CREDIT_TEST_DATABASE_URL="postgresql://username:password@localhost:5432/credit_test" \
CREDIT_TEST_RABBITMQ_URL="amqp://username:password@localhost:5672/isolated_test_vhost" \
npm run test:integration
```

Use a fresh, dedicated RabbitMQ vhost with permission to create exchanges, queues and bindings, and no other consumers. The suite does not purge existing queues. Remove the test vhost afterward.

PostgreSQL tests create and drop isolated schemas. They leave existing application data and real credentials untouched. Checks are skipped when their test URLs are missing.

### Earlier validation results

These results were reported for earlier F5, F6 and F7 changes. They do not verify the latest reservation changes against a live broker.

| Change | Reported checks |
| --- | --- |
| F5 | Nine F4 PostgreSQL subtests and nine F5 PostgreSQL/broker subtests |
| F6 | TypeScript build, five unit tests, and all 25 isolated PostgreSQL/RabbitMQ tests with no skips (23 subtests plus two parent tests) |
| F7 | TypeScript build, six unit tests, and all 28 isolated PostgreSQL/RabbitMQ tests with no skips (26 subtests plus two parent tests) |

F5 coverage includes conservation of credits, rejection of changed repeat events, recovery when an account is missing, concurrent operations, abort races, rollback after ledger failure, overflow and reserved-balance checks, F3 history, lost acknowledgments, real delayed retries, DLQ/redrive, mandatory publishing with no matching route, connection loss between commit and acknowledgment, and background-consumer shutdown.

F6 adds cancellation/expiry ledger and F3 history checks, conflicts on changed repeat events, reuse of event IDs across reservation cycles, balance limits, injected ledger failures, simultaneous receive/cancel/expire/abort operations, protection of renewed holds, lost acknowledgments, and real F6 routing/retry/DLQ/redrive. It needs no migration or new dependency.

F7 adds concurrent repeat delivery that applies the refund once, conflicts on changed repeat events, REFUND history/deltas, event-ID reuse, overflow and insufficient reserved balance, conflicts after transfer while another hold exists, injected ledger failures, lost acknowledgments, protection of renewed holds, competing receive/release/refund/abort operations, and real failure routing/delayed retry/DLQ/redrive.

The temporary database, role and broker vhost were removed after the F6 run. The temporary test database and broker vhost were removed after the F7 run.

Order failure producers, outbox and recovery, full Order/browser workflows, broker restart survival, and deployed access control/security remain unverified.
