# Credit service

Groups 1 and 2 provide PostgreSQL/Prisma credit storage, an idempotent initial-grant function, and RabbitMQ delivery from the user-service transactional outbox. Current balances live in `CreditAccount`; an append-only `CreditTransaction` ledger records changes. This is not full event sourcing.

Balance/history endpoints and frontend changes remain subsequent work. Reservation, transfer, release, refund, and order-consumer workflows (F4–F9) remain out of scope; their transaction types are reserved in the schema.

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
| `JWT_PUBLIC_KEY_PATH` | Path to the PEM public key matching user-service's RS256 signing key. Relative paths resolve from the process working directory. |

The Prisma CLI needs `DATABASE_URL`. The application and shared Prisma-client module load the full application configuration; starting the HTTP server also reads the JWT public-key file. Keep credentials and key files out of Git.

Apply the checked-in migrations, generate the client, and build:

```sh
npm run db:deploy
npm run db:generate
npm run build
```

Start development with `npm run dev`, or run the compiled application with `npm start`. The registration consumer starts in the background after HTTP begins listening and reconnects during broker outages. `GET /credits` reports HTTP liveness, not broker connectivity or successful provisioning. No public grant, balance, or history endpoint is available yet.

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

Malformed/unsupported events, invalid retry metadata, permanent failures (including `CREDIT_ACCOUNT_INCONSISTENT`), and retry exhaustion go to the dead-letter queue. Every application retry or dead-letter transfer must be confirmed before the original is acknowledged. Failed forwarding leaves the original unacknowledged and triggers reconnection. Reconnect backoff is capped at 60 seconds. Lost confirmations/acknowledgments can cause extra deliveries beyond the scheduled retry count; Group 1's idempotency prevents additional grants.

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
- A PostgreSQL trigger rejects ledger `UPDATE`, `DELETE`, and `TRUNCATE` statements. Corrections require new entries; no correction workflow is implemented in Group 1.
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
- Future balance/history endpoints must enforce student-only access; admins cannot read balances or history. Promotion to admin must preserve existing credit records.
- Future balance changes and their transaction entries must commit atomically. Display available and reserved balances separately: available credits are already spendable, so do not subtract reserved credits again.

## History contract for subsequent groups

Supported types are `INITIAL_ALLOCATION`, `RESERVATION`, `TRANSFER_SENT`, `TRANSFER_RECEIVED`, `RELEASE`, and `REFUND`. Only initial allocation has an implemented write workflow.

History queries must scope to the student's account. The default order is `createdAt DESC, id DESC`; ascending timestamp sorting uses `createdAt ASC, id ASC`, with ID as the deterministic tie-breaker. Apply transaction-type filtering within the same account scope.

The schema includes indexes on `(accountId, createdAt DESC, id DESC)` and `(accountId, type, createdAt DESC, id DESC)` to support these queries. Indexes do not themselves establish a query's ordering; callers must specify it explicitly. History endpoints, pagination, and navbar display remain subsequent work.

## Validation

```sh
npx prisma validate
npm run db:generate
npm run build
```

No automated tests were added for Groups 1 or 2. The current `npm test` script is a placeholder that exits with an error. Schema validation, compilation, and CLI help checks do not verify live migration execution, concurrent grants, broker failover, or redrive delivery guarantees.
