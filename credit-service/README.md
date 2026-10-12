# Credit service

Credit-service provides PostgreSQL/Prisma credit storage, an idempotent initial-grant function, and RabbitMQ delivery from the user-service transactional outbox. Current balances live in `CreditAccount`; an append-only `CreditTransaction` ledger records changes. This is not full event sourcing.

Authenticated, student-only read APIs expose current balances and transaction history for the navbar and transaction-history UI. F4 reservation and creation-abort recovery APIs are implemented for trusted Order Service calls. Transfer, lifecycle release/refund, and order-settlement consumer workflows remain unimplemented.

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

The Prisma CLI needs `DATABASE_URL`. The application and shared Prisma-client module load the full application configuration; starting the HTTP server also reads the JWT public-key file. Keep credentials and key files out of Git.

Apply the checked-in migrations, generate the client, and build:

```sh
npm run db:deploy
npm run db:generate
npm run build
```

Start development with `npm run dev`, or run the compiled application with `npm start`. The registration consumer starts in the background after HTTP begins listening and reconnects during broker outages. `GET /credits` reports HTTP liveness, not broker connectivity or successful provisioning. Authenticated read endpoints are available under `/api/credits/me`; no public grant endpoint is exposed.

## RabbitMQ and service startup

RabbitMQ runs in Docker; no native RabbitMQ installation is needed. Start Docker Desktop/the Docker engine first. From the repository root:

```sh
docker compose config --quiet
docker compose up -d rabbitmq
docker compose ps
docker compose logs --tail=50 rabbitmq
```

If macOS reports `docker: command not found` and Docker Desktop installed its CLI under `~/.docker/bin`, run `export PATH="$HOME/.docker/bin:$PATH"` in your terminal. Add that export to `~/.zshrc` to keep it for new shells.

Compose downloads `rabbitmq:4.2-management`, binds AMQP port `5672` and management port `15672` to localhost, and stores broker data in a named volume. The management UI is at <http://localhost:15672>; development defaults are `foc` / `foc-local-only`. Override these using `RABBITMQ_USER` and `RABBITMQ_PASSWORD` in the **root** `.env`. These initialize a fresh broker volume; changing them later does not update existing broker users.

Set `RABBITMQ_URL` in **both service directories'** `.env` files to matching credentials. URL-encode special characters in credentials. Services running on your host use `localhost`; a future containerized service on the same Compose network uses hostname `rabbitmq`. Root `.env` values are not automatically loaded by host service processes.

Apply migrations and generate clients in each service before startup:

```sh
(cd user-service && npm ci && npm run db:deploy && npm run db:generate && npm run build)
(cd credit-service && npm ci && npm run db:deploy && npm run db:generate && npm run build)
```

Run `npm start` from each service directory in separate terminals, or use `npm run dev`. The user-service publisher and credit-service consumer run inside their existing processes; there are no separate worker commands. Each connection declares the complete topology before processing, so either service may start first. Broker downtime does not block HTTP startup. Stop services with Ctrl+C; their shutdown handlers finish in-flight work where possible, with a 15-second shutdown deadline.

Use `docker compose stop rabbitmq` to stop the broker and `docker compose start rabbitmq` to restart it. The volume survives these commands and ordinary `docker compose down`. **`docker compose down -v` deletes broker data.** This single-node local setup supports restart persistence, not high availability or recovery from permanent volume loss.

## Registration delivery contract

This is an event carried in an AMQP message, not a request to set a configurable balance:

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

The consumer requires exactly these fields, valid UUIDs, a UTC ISO timestamp ending in `Z`, and AMQP `messageId` equal to `eventId`. Email, passwords, and grant amounts are absent. Broker publishers are trusted to report verified student registrations; this consumer does not query user-service for eligibility. Restrict broker publishing credentials accordingly.

| Component | Declaration |
| --- | --- |
| Exchange | Durable topic exchange `foc.events` |
| Registration route | `user.registered.v1` → `credit.user-registered.v1` |
| Retry queue | `credit.user-registered.retry.v1`, 10-second TTL, dead-letter route back to the registration exchange/key |
| Dead-letter queue | `credit.user-registered.dead.v1`, no TTL |

All three queues are durable quorum queues, with `reject-publish` overflow and automatic delivery-count limits disabled. The retry queue explicitly uses at-least-once dead-lettering. Retry/dead-letter publications address queue names through the default exchange. Both services maintain identical topology declarations in `src/libs/rabbitmq.ts`; update both together when changing the contract.

Publishers use persistent messages, mandatory routing, and publisher confirms, with a 10-second confirmation timeout. A confirm alone is not successful routing if the message was returned. Publication confirmation means the broker accepted the message, not that credits have been granted.

The consumer processes one delivery at a time (`prefetch: 1`). It acknowledges only after the grant function resolves, including duplicate-grant success. Transient database connection failures, timeouts, and transaction conflicts receive five delayed retries after the first attempt: up to six application processing attempts. `x-retry-count` starts at zero and increments on each scheduled retry. The 10-second TTL is a minimum waiting period; outages or backlog can delay delivery further.

Malformed/unsupported events, invalid retry metadata, permanent failures (including `CREDIT_ACCOUNT_INCONSISTENT`), and retry exhaustion go to the dead-letter queue. Every application retry or dead-letter transfer must be confirmed before the original is acknowledged. Failed forwarding leaves the original unacknowledged and triggers reconnection. Reconnect backoff is capped at 60 seconds. Lost confirmations/acknowledgments can cause extra deliveries beyond the scheduled retry count; The initial-grant function’s idempotency prevents additional grants.

## Inspecting and redriving dead letters

From the repository root, inspect ready and unacknowledged messages without consuming them:

```sh
docker compose exec rabbitmq rabbitmqctl list_queues -p / name messages_ready messages_unacknowledged consumers
```

Look for `credit.user-registered.dead.v1`. The management UI also shows these counts and queue arguments. Consumer logs include event ID/user ID when valid, attempt, outcome, and a bounded failure reason. Do not use an acknowledging "get messages" operation merely to inspect messages. For unpublished outbox counts and age, see [user-service operations](../user-service/README.md#credit-provisioning-outbox).

After resolving the original failure, stop credit-service while keeping RabbitMQ running, then from `credit-service`:

```sh
npm run redrive -- --limit 10
```

For a compiled deployment:

```sh
npm run redrive:prod -- --limit 10
```

Only `RABBITMQ_URL` is required by this standalone command; it does not initialize Prisma or the HTTP server. Restart credit-service after redrive. Pausing the consumer avoids repeatedly processing a still-failing event that returns to the dead-letter queue during the same run. Run one redrive command at a time.

The command processes oldest available dead letters, bounded by the requested positive integer and the initial ready count. It preserves exact event bytes, event ID, occurrence time, and message ID; resets `x-retry-count` to zero; increments `x-redrive-count`; and sets `x-redriven-at`. It retains failure/death headers for diagnosis but does not copy message expiration or AMQP user identity. Each dead letter is acknowledged only after confirmed republication to the registration route.

A broker failure stops the command with exit code 1, leaving the current unacknowledged message available again when the connection closes. Invalid event bodies/identities or invalid redrive counts also stop the command without removing that message. Investigate them separately; this tool does not rewrite events or repair accounts. A crash after forwarding but before acknowledgment may leave a duplicate; the grant remains idempotent. Redrive success means republished, not successfully granted. `npm run redrive -- --help` displays usage without contacting the broker.

## Migration contract

Deploy `20261012000000_add_credit_transaction_ledger` before using the grant function. `npm run db:deploy` applies pending migrations, including the original account migration on a fresh database. Client generation is a separate step.

The ledger migration runs in a transaction. It adds constraints, the transaction enum/table, indexes, and append-only enforcement without creating accounts, changing balances, or granting credits to existing users. Existing negative balances cause migration failure; investigate and explicitly remediate invalid data rather than silently resetting balances or granting credits. Follow Prisma's failed-migration recovery process before retrying a failed deployment.

Database invariants:

- `availableCredits` and `reservedCredits` are non-negative integers.
- Transaction `amount` is a positive integer; `availableDelta` and `reservedDelta` are signed integers.
- `idempotencyKey` is unique across the ledger.
- A SQL partial unique index permits at most one `INITIAL_ALLOCATION` per account.
- A PostgreSQL trigger rejects ledger `UPDATE`, `DELETE`, and `TRUNCATE` statements. Corrections require new entries; no correction workflow is implemented.
- The local account foreign key uses `ON DELETE RESTRICT ON UPDATE RESTRICT`. Ledger records cannot be cascaded away with an account.

Checks, the partial unique index, and the trigger/function are maintained in migration SQL. Preserve them when creating future migrations; Prisma schema declarations alone do not describe all these invariants. Use `npm run db:migrate -- --name <change_name>` only to author migrations against a development database, and review the generated SQL. Use the checked-in migrations for deployment rather than substituting `prisma db push`. `npm run db:reset` destroys database data and is not an upgrade procedure.

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

Both writes commit together or roll back together. A successful first call returns `created: true`. Repeated or concurrent duplicate calls return the existing account and original grant with `created: false`, after any failed account-creation transaction has rolled back. They do not add credits or reset balances, even if later activity has changed those balances.

An existing account must have exactly one initial-allocation record matching the deterministic key, amount, deltas, and null order ID. The function does not repair an account lacking that record or having an incompatible record.

| Failure | Contract |
| --- | --- |
| Invalid UUID | `AppError` with code `INVALID_USER_ID`, status `400`; no database writes. |
| Missing or incompatible grant on an existing account | `AppError` with code `CREDIT_ACCOUNT_INCONSISTENT`, status `500`; investigate without automatic repair. |
| Other database/transaction failure | Error propagates. Writes in the failed provisioning transaction roll back. |

These statuses are error metadata, not a public HTTP grant API. A connection failure can leave the caller uncertain whether a commit succeeded; retrying with the same user ID is safe.

## Access and provisioning boundaries

- Call the internal function only for newly verified students. It does not query user-service or verify role/verification state itself. Do not run it over all existing users as a migration or startup backfill.
- User-service commits user creation and its provisioning outbox event together. Registration succeeds while credit provisioning is pending; an absent account must not be mistaken for a successfully provisioned zero balance.
- Acknowledge delivery after the function resolves, including `created: false`. If acknowledgment is lost after commit, redelivery is safe. Retry transient database failures; route invalid IDs and `CREDIT_ACCOUNT_INCONSISTENT` failures for investigation rather than repeatedly granting or resetting credits.
- Balance/history endpoints enforce student-only access; admins cannot read balances or history. Promotion to admin preserves existing credit records. Authorization uses the role in the verified JWT; these endpoints do not query user-service or revoke already-issued student tokens on promotion.
- Future balance changes and their transaction entries must commit atomically. Display available and reserved balances separately: available credits are already spendable, so do not subtract reserved credits again.

## Credit read API contract

Both endpoints require `Authorization: Bearer <access-token>`. Tokens must verify using RS256 and contain a UUID `userId`, a string `email`, and a recognized role. Only `STUDENT` is authorized; valid `ADMIN` tokens receive 403, including when an account exists from before promotion.

The account is selected exclusively from the verified JWT user ID. There is no account/user ID route parameter or query parameter. Neither endpoint reads an identity from the request body. Send GET requests without bodies. Reads never create accounts, grant credits, or change the ledger.

### Exact response types

The following are the JSON wire types for frontend consumers. Backend response definitions live in `src/types/credit.types.ts`; the transaction-type values come from the Prisma enum.

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

READY responses use HTTP 200; PROVISIONING responses use HTTP 202. Errors use the error envelope without `data`. All fields shown in each response variant are required. IDs are UUID strings; timestamps are UTC ISO strings serialized with milliseconds and a trailing `Z`. Balances are non-negative integers, transaction amounts are positive integers, and deltas are signed integers. `orderId` is always present, including when `null`. Account IDs, user IDs, and idempotency keys are not returned as item fields.

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

This response has no numeric balances, timestamps, items, or cursor. Treat it as pending, not as a zero balance or empty transaction history. Axios treats 202 as success: inspect `response.data.data.status` before reading READY fields. A database failure returns an error instead of this response.

An absent legacy account also produces PROVISIONING; reads do not backfill it, and the response does not guarantee eventual provisioning. No polling interval or completion deadline is supplied by the API. Provide a refresh/retry action without treating repeated 202 responses as completed provisioning.

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

Unknown parameters, repeated parameters/arrays, empty values, invalid enum values, and invalid limits return 400. Limits containing signs, spaces, decimal points, or exponent notation are invalid. Do not send `type=ALL`, `cursor=null`, or empty strings to represent omission.

History is restricted to the authenticated student's account, including when filtering. Initial allocation, reservation and creation-abort release write to this same ledger. F5 receipt transfers write `TRANSFER_SENT` and `TRANSFER_RECEIVED` rows. Cancellation/expiry/failure settlement remains pending.

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

`amount` is a positive magnitude; use `availableDelta` and `reservedDelta` when displaying signed changes to each balance.

### Sorting and pagination

The API explicitly orders by `createdAt DESC, id DESC` by default and `createdAt ASC, id ASC` for `sort=asc`. Preserve the returned order in the UI: PostgreSQL timestamps retain microseconds, which the serialized timestamps cannot fully represent. Transaction ID is the tie-breaker for equal stored timestamps.

Each page contains at most `limit` items. `nextCursor` is a string only when a further row was found; it is `null` at the end. Cursors are scoped to the account, type filter (including no filter), and sort direction. They must refer to an existing transaction within that scope. Malformed or incompatible cursors return 400. Treat tokens as opaque; do not decode, edit, or construct them in the frontend. The server independently enforces account access regardless of cursor content.

Keep type and sort unchanged between pages; changing either resets the list and cursor. Changing `limit` is allowed. Query syntax and cursor structure are validated before account lookup; account-dependent cursor checks occur only after an account is found. A structurally valid request for a missing account returns 202.

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

Pagination reads live data rather than a frozen snapshot. Newly inserted rows before the current cursor are seen by refreshing the first page; rows after it may appear on subsequent pages. Do not infer a total count from page length. Existing indexes on `(accountId, createdAt DESC, id DESC)` and `(accountId, type, createdAt DESC, id DESC)` support these reads; no new migration is required.

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

Frontend consumers should hide credit UI for admins and use the existing authentication refresh handling for 401 responses. Do not treat 403 or 500 as provisioning, zero balance, or empty history. On a cursor error, offer a restart from the first page. The transaction-history UI should distinguish READY with no items, PROVISIONING, and request errors; discard stale page responses after the user changes filters or sort.

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

The integration suite creates a randomly named schema, applies all checked-in migrations there, and drops only that schema afterward. The database role needs schema-creation permission. No integration URL means the database suite is skipped. Use a dedicated test database; do not point tests at production.

Validated locally: schema/client generation, TypeScript build, three unit/HTTP-auth tests, and nine PostgreSQL subtests covering reservations, duplicate/concurrent requests, insufficient credits, rollback after injected ledger failure, abort races/tombstones, HTTP contracts, adapter connection failure, F1/F2/F3 regressions and existing SQL protections. F5 validation is documented below. Full Order creation/recovery, F6/F7 settlement, broker restart drills and browser E2E remain unverified.

## Internal F4 reservation API

These routes require `Authorization: Bearer <ORDER_CREDIT_SERVICE_TOKEN>`. Student JWTs do not authorize them. Keep `/internal/credits` off public ingress and use HTTPS between deployed services. The token is read from environment at request time; it is never returned or logged.

| Method/path | Purpose |
| --- | --- |
| `POST /internal/credits/reservations` | Create a hold or return an identical retry's current state. |
| `GET /internal/credits/reservations/:reservationId` | Recover committed state after a timeout. |
| `POST /internal/credits/reservations/:reservationId/abort` | Return a creation hold or create an unfunded abort tombstone. |

Both POST bodies contain exactly these immutable fields (abort's body ID must match the path):

```json
{
  "reservationId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6481",
  "orderId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6482",
  "requesterId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6483",
  "amount": 10
}
```

UUIDs are normalized to lowercase. Amounts must be positive integers at most 2,147,483,647. Responses use `{ success: true, data: <reservation> }`; `data.id` is the supplied reservation ID, and `data.status` is the current committed lifecycle state. New reserve returns 201; identical retry, lookup and abort return 200. Errors use the existing `{ success: false, code, message }` envelope: invalid input 400, invalid/missing service token 401, absent account/reservation 404, insufficient credits/immutable mismatch/active-order conflict/invalid abort lifecycle 409, temporary database unavailability or exhausted serialization retries 503.

Reservation, conditional balance update and ledger insertion commit together with Serializable isolation and at most three serialization/deadlock attempts. Reservation-insert uniqueness collisions are resolved after rollback and never authorize mismatched inputs. A reserve of 10 from 50 leaves 40 available and 10 reserved; reserve never provisions an account. Funded abort returns credits with one `RELEASE` row. Unfunded abort creates an `ABORTED` tombstone without an account or ledger row; delayed reserve returns that terminal state without holding funds.

Order must persist the attempt and IDs before calling Credit, reuse them after timeouts, and finalize an order only after observing `RESERVED`. A terminal response is not permission to create an OPEN order. Only a durably fenced ABORTING creation attempt may invoke abort; do not use this endpoint for ordinary cancellation or release holds based on age/timeouts. That Order-side attempt/finalization/recovery workflow is still pending.

## F5 receipt settlement

Credit consumes only `ORDER_RECEIVED` v1 on `foc.events` / `order.received.v1`.
`ORDER_COMPLETED` does not pay the courier. No browser-facing transfer endpoint exists.
Order must authorize receipt and commit its guarded status transition and outbox event
atomically; that Order producer and outbox publisher are still pending.

Publish persistent JSON with publisher confirms and mandatory routing. `messageId`
must equal the lowercase `eventId` (the original outbox UUID). Retries preserve it and
all envelope fields:

```json
{
  "eventId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6490",
  "eventVersion": 1,
  "eventType": "ORDER_RECEIVED",
  "occurredAt": "2026-10-12T00:00:00.000Z",
  "orderId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6482",
  "orderVersion": 7,
  "reservationId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6481",
  "requesterId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6483",
  "courierId": "d0379a4b-657c-4aaf-a2c9-cde57bbb6484",
  "amount": 10,
  "orderName": "Lunch"
}
```

All fields are required; extra fields are rejected. Maximum body size is 64 KiB.
UUIDs are normalized to lowercase; amount is a positive PostgreSQL Int;
orderVersion is an integer from 0 through 2,147,483,647; occurredAt is an ISO datetime
with timezone; orderName is 1–255 characters. Requester and courier must differ.
The complete validated envelope is stored to reject altered replays, including
changes to orderVersion, occurredAt or orderName.

A Serializable transaction checks the exact reservation's order/requester/amount,
claims RESERVED → TRANSFERRED, deducts the stored amount from requester reserved
credits, adds it to courier available credits, and writes both ledger rows. It
stores RECEIVED, courier, event identity, envelope and settledAt together. Existing
accounts are required; transfers never provision accounts. Insufficient reserved
balance, account inconsistency, courier Int overflow, a reused event ID on another
cycle, or a contradictory terminal outcome rolls back unchanged. Identical replay
is a no-op. At most three local serialization/deadlock attempts run before delayed
retry. Balances settle asynchronously after Order receipt.

The separate durable quorum queues are `credit.order-settlement.v1`,
`credit.order-settlement.retry.v1` and `credit.order-settlement.dead.v1`. Only the
receipt route is bound for F5; registration topology is unchanged. The retry queue
uses a 10-second TTL, reject-publish overflow and at-least-once dead-lettering back
to the receipt route. Missing account/reservation or exhausted local serialization
retries get at most five delayed retries (six processing attempts); malformed
messages and conflicts go directly to the DLQ. Dead letters have no TTL. A database
outage closes the consumer session and backs off from 1 to 60 seconds without
incrementing the per-event retry count. Retry/DLQ forwarding requires confirmation
and successful routing before acknowledging the original. The consumer starts
alongside registration after HTTP listening, uses prefetch 1, and stops before
Prisma disconnects. No additional environment variables or migration are needed.

Inspect the DLQ, repair the underlying cause, then replay valid original events:

```sh
npm run redrive:settlement -- --limit 10
```

This bounded command preserves body and event/message identity, resets the retry
count, increments the redrive count, and acknowledges the DLQ delivery only after
confirmed routing. Invalid envelopes stop the run and remain queued. Contradictory
terminal events need investigation; replay cannot overwrite a settled reservation.
Never edit balances, replace event IDs, purge queues or delete broker volumes to
recover held funds. Deployment still requires a private broker, dedicated virtual
host, restricted publisher/consumer credentials and TLS.

Optional broker integration checks run together with PostgreSQL tests:

```sh
CREDIT_TEST_DATABASE_URL="postgresql://username:password@localhost:5432/credit_test" \
CREDIT_TEST_RABBITMQ_URL="amqp://username:password@localhost:5672/isolated_test_vhost" \
npm run test:integration
```

Use a fresh dedicated RabbitMQ vhost with topology permissions and no other
consumers; the suite does not purge existing queues. Remove the test vhost after
the run. PostgreSQL tests create/drop isolated schemas; existing application data
and real credentials are untouched. Without test URLs, the corresponding checks
are skipped.

Validated locally: five envelope/forwarding/outage unit tests; nine F4 PostgreSQL
subtests and nine F5 PostgreSQL/broker subtests. F5 covers conservation, immutable
replay, missing-account recovery, concurrency, abort races, rollback after ledger
failure, overflow and reserved-balance guards, F3 history, lost acknowledgment,
real delayed retry, DLQ/redrive, mandatory unroutable publication, connection loss
between commit and acknowledgment, and background-consumer shutdown. Broker restart,
complete Order/browser workflows and deployed access control remain unverified.
