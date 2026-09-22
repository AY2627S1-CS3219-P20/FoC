# supplier-service

Supplier management backend for Friend On Campus. Serves supplier data to all
users and lets administrators create, update, and deactivate suppliers.

## Functional requirements

| ID | Requirement | Status |
| --- | --- | --- |
| F1 | Users view available suppliers | Implemented (`GET /api/supplier`) |
| F2 | Administrators create suppliers | **Implemented** (`POST /api/supplier`) |
| F3 | Administrators update suppliers | **Implemented** (`PATCH /api/supplier/:id`) |
| F4 | Administrators deactivate suppliers | **Implemented** (`PATCH /api/supplier/:id/deactivate`) |
| F5 | Administrators manage supplier types | Not implemented in this service |
| F6 | Seed initial supplier data | Implemented via `prisma/seed.ts` |

## API

All routes are protected by JWT authentication (`authenticate`). The
`POST` / `PATCH` routes require the `admin` role (`requireAdmin`).

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/supplier` | any | List all available suppliers |
| `POST` | `/api/supplier` | admin | Create a supplier (active by default) |
| `PATCH` | `/api/supplier/:id` | admin | Update a supplier |
| `PATCH` | `/api/supplier/:id/deactivate` | admin | Deactivate a supplier |

### Create supplier (`POST /api/supplier`)

Request body:

```json
{
  "name": "Starbucks",
  "type": "FOOD",
  "building": "Engineering Building",
  "floor": 1,
  "description": "Coffee and pastries",
  "address": "4 Engineering Road",
  "latitude": 1.30,
  "longitude": 103.77,
  "imageUrl": "https://example.com/starbucks.jpg",
  "openingHours": [
    { "day": "MONDAY", "openingTime": "08:00", "closingTime": "18:00" }
  ]
}
```

- `name`, `type`, `building`, `floor`, `description`, `address` are required.
- `type` must reference an existing supplier type.
- `name` matching is case-insensitive — duplicates are rejected (`409`).
- `latitude`, `longitude`, `imageUrl`, and `openingHours` are optional.
- New suppliers are stored with `status = ACTIVATED` (F2.1.5).

### Update supplier (`PATCH /api/supplier/:id`)

Partial body using the same fields as create. Only provided fields are
changed. If `openingHours` is provided, the supplier's existing hours are
replaced. An empty body is rejected (`400`).

### Deactivate supplier (`PATCH /api/supplier/:id/deactivate`)

Sets `status = DEACTIVATED`. The record is kept so historical orders remain
viewable. Rejects unknown suppliers (`404`) and already-deactivated suppliers
(`409`). Deactivated suppliers no longer appear as available for new errands.

### Response shape

Success:

```json
{ "success": true, "code": "SUCCESS", "data": { /* supplier record */ } }
```

Errors:

```json
{ "success": false, "code": "CONFLICT", "message": "..." }
```

## Validation

Input is validated with [Zod](https://zod.dev) in `src/schemas/supplier.schema.ts`.
Invalid bodies are converted to a `422 UNPROCESSABLE_ENTITY` `AppError` by the
`parseInput` helper.

## Architecture

```
src/
  config/        environment configuration
  constants/     roles and default supplier types
  controllers/   HTTP handlers (parse body -> call service -> respond)
  services/      business logic (receives Prisma via dependency injection)
  routes/        route table + middleware wiring
  middleware/    authentication, admin role gating, error handling
  schemas/       Zod schemas + parseInput helper
  errors/        AppError + default error codes
  libs/          Prisma client singleton
```

The service layer takes the Prisma client as a parameter (rather than
importing a singleton directly). This keeps the business logic free of
singleton imports and trivially unit-testable with a fake client.

## Development

```bash
cp .env.example .env          # fill in DATABASE_URL and JWT_PUBLIC_KEY_PATH
npm install
npm run db:migrate            # apply schema migrations to Postgres
npm run dev                   # start the API on $PORT (default 3001)
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run the API with hot reload (`nodemon` + `tsx`) |
| `npm run build` | Type-check and compile to `dist/` |
| `npm test` | Run the test suite (`node:test` + `tsx`) |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |

## Testing

Tests use Node's built-in test runner (`node:test`) executed through `tsx`, so
no extra test dependencies are required.

```bash
npm test
```

- `src/schemas/supplier.schema.test.ts` — Zod schema validation + `parseInput` error mapping.
- `src/services/supplier.service.test.ts` — create/update/deactivate logic driven by an in-memory fake Prisma client (no database needed).
