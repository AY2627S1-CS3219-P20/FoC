# Credit service

Group 1 provides PostgreSQL/Prisma credit storage and an internal initial-grant function. Current balances live in `CreditAccount`; an append-only `CreditTransaction` ledger records changes. This is not full event sourcing.

RabbitMQ integration, the user-service transactional outbox, balance/history endpoints, and frontend changes are not implemented here. Reservation, transfer, release, refund, and order-consumer workflows (F4–F9) remain out of scope; their transaction types are reserved in the schema.

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

Start development with `npm run dev`, or run the compiled application with `npm start`. `GET /credits` is the existing health endpoint. No public grant, balance, or history endpoint is available yet.

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

Pass a full Prisma client; the function owns its transaction. For example, a future credit-service consumer under `src/` can call:

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

## Group 2 integration responsibilities

- Call the internal function only for newly verified students. It does not query user-service or verify role/verification state itself. Do not run it over all existing users as a migration or startup backfill.
- Implement RabbitMQ delivery using a user-service transactional outbox so user creation and its provisioning event commit together. Registration succeeds while credit provisioning is pending; an absent account must not be mistaken for a successfully provisioned zero balance.
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

No tests were added for Group 1. The current `npm test` script is a placeholder that exits with an error. Schema validation and compilation do not verify migration execution or concurrent behavior against PostgreSQL.
