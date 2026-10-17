# supplier-service

Supplier management backend for Friend On Campus. Serves supplier data to all
users and lets administrators create, update, and deactivate suppliers.

## Functional requirements

| ID | Requirement | Status |
| --- | --- | --- |
| F1 | Users view available suppliers | Implemented (`GET /api/suppliers/active`) |
| F2 | Administrators create suppliers | Implemented (`POST /api/suppliers`) |
| F3 | Administrators update suppliers | Implemented (`PATCH /api/suppliers/:supplierId`) |
| F4 | Administrators deactivate suppliers | Implemented (`PATCH /api/suppliers/:supplierId/deactivation`) |
| F5 | Administrators manage supplier types | Implemented (`POST /api/suppliers/types` and `DELETE /api/suppliers/types/:typeId`) |
| F6 | Seed initial supplier data | Implemented via `prisma/seed.ts` |

## API

All routes are protected by JWT authentication (`authenticate`). The
`POST` / `PATCH` routes require the `admin` role (`requireAdmin`).

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/suppliers/` | admin | View the suppliers (ALL suppliers regardless of status) based on the current page, search key (case-insensitive) and type filter |
| `GET` | `/api/suppliers/active` | any | View the ACTIVE suppliers based on the current page, search key (case-insensitive) and type filter |
| `GET` | `/api/suppliers/by-ids` | any | Get relevant suppliers (id, name, type) information by supplying a list of supplier IDs |
| `GET` | `/api/suppliers/:supplierId` | any | Get full supplier information by supplying its supplier IDs |
| `POST` | `/api/suppliers` | admin | Create a supplier (active by default) |
| `PATCH` | `/api/suppliers/:supplierId` | admin | Update a supplier |
| `PATCH` | `/api/suppliers/:supplierId/deactivation` | admin | Deactivate a supplier |
| `GET` | `/api/suppliers/types` | all | Get all existing supplier types |
| `GET` | `/api/suppliers/types/count` | admin | For each supplier type, count the number of supplier records associated to it |
| `POST` | `/api/suppliers/types` | admin | Create a new supplier type |
| `DELETE` | `/api/suppliers/types/:typeId` | admin | Delete an existing supplier type with no supplier records associated to it |
| `POST` | `/api/suppliers/assets/images/` | admin | Upload image of a supplier |

### Query suppliers (`GET /api/suppliers/`)
Pagination is an option for querying suppliers. If the entire list of suppliers is to be queried, the `page` parameter should be left undefined. Otherwise, pass a positive integer to the `page` query parameter. Each page displays a maximum of 15 records. The `typeFilter` and `searchString` are also optional fields in the request parameters that can be passed by the caller. The supplier records returned will:
1. have a name that contains the searchString (case-insensitive)
2. have a supplier type that is equal to `typeFilter`
3. after filtering for supplier records that fulfil conditions (1) and (2) and sorting these records in alphabetical (case-sensitive) order, supplier records returned are the first `{1+15*<page_number-1>}`th to `{15*<page_number>}`th records if pagination is required, or a list of al the records if pagination is not required.

Example request URL:
```{base_url}/api/suppliers/?page=2&typeFilter=FOOD```

Example response for data: 
```json
{
    "data": {
        "suppliers": [< supplier data>],
        "pagination": {
            "limit": 15,
            "page": 2,
            "totalCount": 40,
            "totalPages": 3
        }
    }
}
```

### Query active suppliers (`GET /api/suppliers/active`)
From the outside world, the way this endpoint is called and its response is exactly the same as the above (query all suppliers) endpoint, but within the `supplier-service`, only `ACTIVE` suppliers are filtered out and returned. 


### Create supplier (`POST /api/suppliers/`)

Request body:

```json
{
  "name": "Starbucks",
  "type": "FOOD",
  "building": "Engineering Building",
  "floor": "1",
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

### Update supplier (`PATCH /api/suppliers/:supplierId`)

Partial body using the same fields as create. Only provided fields are
changed. If `openingHours` is provided, the supplier's existing hours are
replaced. An empty body is rejected (`400`).

### Deactivate supplier (`PATCH /api/suppliers/:supplierId/deactivation`)

Sets `status = DEACTIVATED`. The record is kept so historical orders remain
viewable. Rejects unknown suppliers (`404`) and already-deactivated suppliers
(`409`). Deactivated suppliers no longer appear as available for new errands.

### Fetch all the current supplier types (`GET /api/suppliers/types`)
A simple function that returns all the supplier types in ascending alphabetical order. No query parameters are required for this endpoint.

### Count the number of associated suppliers for each supplier type (`GET /api/suppliers/types/count`)
For each supplier type in the SupplierType table, count the number of supplier records that is associated to this type. The structure of data that is returned for a successful query is as follows:
```json
{ 
  id: uuid, 
  type: string, 
  count: int 
}
```

### Create a new supplier type (`POST /api/suppliers/types`)
The supplier type to be created must not have the same (case-insensitive) name as any of the current records, else, the app will throw an error code 400. 

Request body:
```json
{
  "type": <type to be created>,
}
```


### Delete an existing supplier type (`DELETE /api/suppliers/types/:typeId`)
The supplier type to be deleted must be an existing supplier type, if not, the app will return an error code 400. The existing supplier type must also have no associated supplier records, if not, the app will return an error code 403. 

### Response shape

Success:

```json
{ "success": true, "code": "SUCCESS", "data": { /* data to be returned */ } }
```

Errors:

```json
{ "success": false, "code": "CONFLICT", "message": "..." }
```

## Validation

Input is validated with [Zod](https://zod.dev) in `src/schemas/supplier.schema.ts`.
Invalid bodies are converted to a `422 UNPROCESSABLE_ENTITY` `AppError` by the
`parseInput` helper.

## Tech Stack
Technology    | Purpose
------------- | -----------------------------
Node.js       | Runtime environment
TypeScript    | Programming language
Express       | Backend web framework
Prisma        | ORM and database access
PostgreSQL    | Relational database
Zod           | Request validation
JWT           | Authentication tokens
CORS          | Cross-origin resource sharing

## Architecture
The supplier service is a backend microservice.
```
┌──────────────────────┐
│      Frontend        │
│   React + TypeScript │
└──────────┬───────────┘
           │
           │ REST API
           ▼
┌──────────────────────────────────────────────┐
│           Supplier Service                   │
│                                              │
│  ┌──────────────┐  ┌──────────────┐          │
│  │    Routes    │→ │ Controllers  │          │
│  └──────────────┘  └──────┬───────┘          │
│                           │                  │
│                    ┌──────▼───────┐          │
│                    │   Services   │          │
│                    └──────┬───────┘          │
│                           │                  │
│                    ┌──────▼───────┐          │
│                    │   Supplier & |          │     
│                    │  SupplierType|          │
│                    │   Management │          │
│                    └──────┬───────┘          │
│                           │                  │     
│                    ┌──────▼───────┐          │
│                    │ Prisma ORM   │          │
│                    └───────┬──────┘          │
└────────────────────────────┼─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Suppliers     │
                    │   SupplierTypes │
                    │   OpeningHours  │
                    └─────────────────┘
```

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

The supplier service also has its own database, with 3 tables, as shown below:
```
Supplier Service
     │
     ▼
  PostgreSQL
     │
     ├── SupplierType
     │
     ├── Supplier
     │
     └── OpeningHours
```
Other microservices do not directly access the Supplier Service's database. All modifications of the data in the database must be done via the Supplier Service's exposed API endpoints.

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
