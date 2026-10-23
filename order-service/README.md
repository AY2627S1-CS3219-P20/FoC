# User Service

## Table of Contents

- [About](#about)
- [Order Lifecycle](#order-lifecycle)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Acknowledgements](#acknowledgements)

## About

The Order Service is responsible for order management and the order lifecycle for **Aaron**.

It uses authorisation and authentication from the User Service and publishes a OutboxEvent whenever another service needs to perform a follow-up action in response to an update to an order status. 

In the Order Service, there are two main roles: Requester (user who created an order request) and Courier (user who accepted an open order request and is responsible for carrying out the request)

### Order Lifecycle Diagram
![Order Lifecycle Diagram](documentation/order-lifecycle.png)

### State Transitions
| from | Action and conditions | to | changedBy | Trigger and credit operation |
|---|---|---|---|---|
| NULL | Request is valid, expiry date in the future, suppliers exist and credits reserved. | OPEN | Requester ID | Request is created.Credit service reserves the offered amount first. If order creation fails, order service attempts to abort the reservation. |
| OPEN | Requester owns the request, no courier is assigned, supplies exits, expected version matches, editable fields are valid, order must be in OPEN status. | OPEN | Requester ID | Requester updates the request. Offered credits cannot be changed after it is created. |
| OPEN | No courier assigned, the user is not the requester, order has not expired, order must be in OPEN status. | ACCEPTED | Courier ID | Courier accepts the request. No change in credit reservations. |
| ACCEPTED | The user is the assigned courier,  order must be in ACCEPTED status. | OPEN | Courier ID | Courier drops the request. No change in credit reservations. |
| ACCEPTED | The user is the assigned courier, order must be in ACCEPTED status. | PICKED_UP | Courier ID | Courier picks up the item. No change in credit reservations. |
| PICKED_UP | The user is the assigned courier, order must be in PICKED_UP status. | COMPLETED | Courier ID | Courier marks delivery as completed. No change in credit reservations. |
| COMPLETED | The order belongs to the requester, order must be in COMPLETED status, a courier must be assigned, credit reservationId must exist, expected version matches. | RECEIVED | Requester ID | Requester confirms they received the item. An ORDER_RECEIVED outbox event triggers the credit service to transfer the reserved credits to the courier. |
| COMPLETED | The order belongs to the requester, order must be in COMPLETED status, a courier must be assigned, credit reservationId must exist, expected version matches. | FAILED | Requester ID | Requester reports that the delivery failed. An ORDER_FAILED outbox event triggers the credit service to refund the reservation. |
| OPEN | The order belongs to the requester, order must be in OPEN status, no courier is assigned, credit reservationId must exist, expected version matches. | CANCELED | Requester ID | Requester cancels the request. An ORDER_CANCELED outbox event triggers the credit service to release the reservation. |
| OPEN | The order must be in OPEN status, no courier has accepted it and expiryAt has passed. | EXPIRED | NULL | The system’s expiry worker automatically expires the request. The expiry worker polls every 10 seconds to check if any order has expired, and updates the order status accordingly. An ORDER_EXPIRED outbox event triggers the credit service to release the reservation. |
| EXPIRED | The order belongs to the requester, order must be in EXPIRED status, credit reservationId must exist, expiry date in the future, expected version matches. | OPEN | Requester ID | Requester renew the expiry time. Credit service creates a new reservation, the order service stores the new reservationId. If order renewal fails, order service attempts to abort the reservation. |

For each transition, the order service performs the below in one database transaction:
- A conditional order creation/update: Checks if all requirements are fulfilled (e.g. pickupSupplierId != deliverySupplierId)
- Adding a new row to track the change in status in orderStatusHistory 
- Creates an outbox event (if applicable)
    - An outbox event is a message to be sent/that has been sent to RabbitMQ. A row with NULL in publishedAt means the message has yet to be sent to RabbitMQ.

We use the expected version which comes from the payload and the current version for optimistic concurrency control.


## Features

### Order Management
- View past order requests made as a requester, with filter, sort and pagination available
- View past order requests accepted as courier, with filter, sort and pagination available
- Create a new order
- Update an existing order

### Order Lifecycle
- Accept an open order as a courier
- Mark an accepted order as picked up as a courier
- Complete a picked up order as a courier
- Mark a completed order as received as a requester
- Mark a completed order as failed as a requester
- Mark a completed order as received as a requester
- Renew an expired order as a requester

### Database

- PostgreSQL database
- Prisma ORM for database management

To ensure concurrency, we use Prisma transactions, which make use of the database’s (Postgres) concurrency control mechanisms to ensure ACID (Atomicity, Consistency, Isolation and Durability) properties of the Order table. 

## Tech Stack

Technology    | Purpose
------------- | -----------------------------
Node.js       | Runtime environment
TypeScript    | Programming language
Express       | Backend web framework
Prisma        | ORM and database access
PostgreSQL    | Relational database
Zod           | Request validation
RabbitMQ      | Messaging


## Architecture

The Order Service is one of the backend microservices in Aaron.

```text
┌──────────────────────┐
│      Frontend        │
│   React + TypeScript │
└──────────┬───────────┘
           │
           │ REST API
           ▼
┌──────────────────────────────────────────────┐
│           Order Service                      │
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
│                    │   Order      |          │
│                    │   Management │          │
│                    └──────┬───────┘          │
│                           │                  │     
│                    ┌──────▼───────┐          │
│                    │ Prisma ORM   │          │
│                    └───────┬──────┘          │
└────────────────────────────┼─────────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │  PostgreSQL         │  
                    │  Orders             │
                    │  OrderStatusHistory │
                    │  OutboxEvent        │
                    └─────────────────────┘
```

### Database

The Order Service has its own PostgreSQL database.

```text
Order Service
     │
     ▼
  PostgreSQL
     │
     ├── Order
     │
     ├── OrderStatusHistory
     │
     └── OutboxEvent
```

Alongside these tables, enums `OrderStatus` and `OrderTypeEvent` are created. 

Other microservices cannot directly access the Order Service database, as they are not on the same Docker internal network as the container running the Order Service's Postgres database. Cross-service references use the order's id and all data queries and updates have to go through the Order Service's exposed APIs. 


## Project Structure

```text
user-service/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── errors/
│   ├── integrations/
│   ├── libs/
│   ├── middlewares/
│   ├── routes/
│   ├── schemas/
│   ├── services/
│   ├── types/
│   ├── workers/
│   └── index.ts
│
├── keys/
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
|── AGENTS.md
|── compose.yaml
|── docker-entrypoint.sh
|── Dockerfile
|── package-lock.json
├── package.json
├── prisma.config.ts
|── README.md
└── tsconfig.json
```

## API Reference

The Order Service exposes REST APIs under the `/api` prefix.

### Authentication

| Method | Route                             | Access Control         | Description                                            |
|--------|-----------------------------------|------------------------|--------------------------------------------------------|
| GET    | /api/orders                       | Authenticated users    | Gets all OPEN orders not posted by the caller          |
| POST   | /api/orders                       | Authenticated students | Create a new order                                     |
| GET    | /api/orders/me/requester          | Authenticated students | Gets all requests made by the authenticated requester  |
| GET    | /api/orders/me/courier            | Authenticated students | Gets all requests made by the authenticated courier    |
| PATCH  | /api/orders/:orderId              | Authenticated students | Update an existing order                               |
| POST   | /api/orders/:orderId/cancellation | Authenticated students | Requester cancels a specified open order               |
| POST   | /api/orders/:orderId/receipt      | Authenticated students | Requester marks a specfied completed order as received |
| POST   | /api/orders/:orderId/failure      | Authenticated students | Requester marks a specified completed order as failed  |
| POST   | /api/orders/:orderId/renewal      | Authenticated students | Requester renews a specified expired order             |
| POST   | /api/orders/:orderId/acceptance   | Authenticated students | Courier accepts a specified open order                 |
| DELETE | /api/orders/:orderId/acceptance   | Authenticated students | Courier drops a specified accepted order               |
| POST   | /api/orders/:orderId/pickup       | Authenticated students | Courier marks a specified accepted orderas picked up   |
| POST   | /api/orders/:orderId/completion   | Authenticated students | Courier marks a specified picked-up orderas completed  |

--------------------------------------------------------------------------------

### `GET /api/orders`

Gets all OPEN orders not posted by the caller. The user can further specify the following:
- `page` (page number): server-side pagination is applied, default to `1`
- `sortBy`: category (either `offeredCredits` or `expiryAt`) to sort the records by, default to `expiryAt`
- `sortOrder`: order to sort the records by, default to `asc`
- `filterLocation`: location that the pickup supplier or delivery supplier must be 
- `searchString`: name of an order that must contain the given `searchString`

```http
Authorization: Bearer <access-token>
```

#### Query Parameters

```text
?page=1&sortBy=expiryAt&sortOrder=asc&filterLocation=&searchString=
```

#### Successful Response

```json
{
    "message": "Requester order history retrieved successfully",
    "data": {
        "orders": [], // full order information retrived will be in this array
        "pagination": {
            "page": 1,
            "limit": 15,
            "totalCount": 0,
            "totalPages": 1
        }
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders`

Creates a new order. The caller must be an authorised user with a `STUDENT` role. 

```http
Authorization: Bearer <access-token>
```

#### Request Body

```json
{ 
    "name": "new test",
    "description": "new test order",
    "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
    "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
    "offeredCredits": 3,
    "remarks": "",
    "expiryAt": "2026-10-23T15:53:00.000Z"
}
```

#### Successful Response

```json
{
    "message": "Order created successfully",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": null,
        "name": "new test",
        "description": "new test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "OPEN",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 1,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:07:40.471Z",
        "acceptedAt": null,
        "pickedUpAt": null,
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`404`  | Invalid supplier id
`500`  | Internal server error

--------------------------------------------------------------------------------

### `GET /api/orders/me/requester`

Gets orders that have been created by the current user, with server-side pagination present. 

```http
Authorization: Bearer <access-token>
```

#### Query Parameters

```text
?page=1&limit=15&status=OPEN&sortBy=createdAt&sortOrder=asc
```

#### Successful Response

```json
{
    "message": "Requester order history retrieved successfully",
    "data": {
        "orders": [
            {
                "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
                "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
                "courierId": null,
                "name": "test",
                "description": "test order",
                "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
                "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
                "offeredCredits": 3,
                "remarks": "",
                "status": "OPEN",
                "expiryAt": "2026-10-23T15:53:00.000Z",
                "version": 1,
                "createdAt": "2026-10-22T16:07:40.471Z",
                "updatedAt": "2026-10-22T16:07:40.471Z",
                "acceptedAt": null,
                "pickedUpAt": null,
                "completedAt": null,
                "receivedAt": null,
                "canceledAt": null,
                "expiredAt": null,
                "failedAt": null,
                "cancellationReason": null,
                "failureReason": null,
                "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 15,
            "totalCount": 1,
            "totalPages": 1
        }
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`500`  | Internal server error

--------------------------------------------------------------------------------

### `GET /api/orders/me/courier`

Gets orders that have been accepted by the current user, with server-side pagination present. 

```http
Authorization: Bearer <access-token>
```
#### Query Parameters

```text
?page=1&status=OPEN&sortBy=createdAt&sortOrder=asc
```

#### Successful Response

```json
{
    "success": true,
    "message": "0 orders previously accepted by courier 5bb703e8-b4f5-4568-bb14-5a2bf9a392b0 retrieved",
    "data": {
        "orders": [],
        "pagination": {
            "limit": 15,
            "page": 1,
            "totalCount": 0,
            "totalPages": 0
        }
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`500`  | Internal server error

--------------------------------------------------------------------------------

### `PATCH /api/orders/:orderId`

Update an existing order, with the specified `orderId` 

```http
Authorization: Bearer <access-token>
```

#### Example Request Body

```json
{ 
    "name": "new updated test"
}
```

#### Successful Response

```json
```json
{
    "message": "Order created successfully",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": null,
        "name": "new updated test",
        "description": "new test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "OPEN",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 1,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:07:40.471Z",
        "acceptedAt": null,
        "pickedUpAt": null,
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`404`  | Invalid orderId specified
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/cancellation`

Cancel an OPEN order with the specified `orderId`. This action can only be done by the requester.  

```http
Authorization: Bearer <access-token>
```

#### Request Body

```json
{ 
    "expectedVersion": 1,
    "cancellationReason": "don't need this anymore"
}
```

#### Successful Response

```json
{
    "message": "Order marked as canceled successfully",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": null,
        "name": "new updated test",
        "description": "new test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "CANCELED",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 1,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:07:40.471Z",
        "acceptedAt": null,
        "pickedUpAt": null,
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be cancelled
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/receipt`

Mark a completed order as received. This action can only be done by the requester. 

```http
Authorization: Bearer <access-token>
```

#### Example Request Body

```json
{
    "expectedVersion": 4
}
```

#### Example Successful Response

```json
{
    "message": "Order marked as received successfully",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": "bfef7411-c83b-4299-82b9-20ab9c52106f",
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "RECEIVED",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 5,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:15:19.758Z",
        "acceptedAt": "2026-10-22T16:11:44.895Z",
        "pickedUpAt": "2026-10-22T16:13:27.719Z",
        "completedAt": "2026-10-22T16:13:42.037Z",
        "receivedAt": "2026-10-22T16:15:19.757Z",
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be mark received
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/failure`

Mark a completed order as failed. This action can only be done by the requester. 

```http
Authorization: Bearer <access-token>
```

#### Example Request Body

```json
{
    "expectedVersion": 4,
    "failureReason": "did not receive item"
}
```

#### Successful Response

```json
{
    "message": "Order marked as failed successfully",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": "bfef7411-c83b-4299-82b9-20ab9c52106f",
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "FAILED",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 5,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:15:19.758Z",
        "acceptedAt": "2026-10-22T16:11:44.895Z",
        "pickedUpAt": "2026-10-22T16:13:27.719Z",
        "completedAt": "2026-10-22T16:13:42.037Z",
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": "2026-10-22T16:15:19.757Z",
        "cancellationReason": null,
        "failureReason": "did not receive item",
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be mark as failed
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/renewal`

Renews an expired request by changing the order status from EXPIRED back to OPEN. This action can only be done by the requester. 

```http
Authorization: Bearer <access-token>
```

#### Query Parameters

```json
{
    "expiryAt": "2026-10-22T16:13:42.037",
    "expectedVersion": 2,
}
```

#### Successful Response

```json
{
    "message": "Order marked as failed successfully",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": "bfef7411-c83b-4299-82b9-20ab9c52106f",
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "FAILED",
        "expiryAt": "2026-10-22T16:13:42.03",
        "version": 2,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:15:19.758Z",
        "acceptedAt": null,
        "pickedUpAt": null,
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be renewed
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/acceptance`

Accepts an OPEN order. This action can be done by any authenticated student, except for the requester. 

```http
Authorization: Bearer <access-token>
```

#### Successful Response

```json
{
    "success": true,
    "message": "Order e94ee4b9-2839-4fbd-b80e-89d1a324b96e accepted by courier bfef7411-c83b-4299-82b9-20ab9c52106f",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": "bfef7411-c83b-4299-82b9-20ab9c52106f",
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "ACCEPTED",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 2,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:11:44.899Z",
        "acceptedAt": "2026-10-22T16:11:44.895Z",
        "pickedUpAt": null,
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`403`  | Caller does not have the permissions to perform this operation
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be accepted
`500`  | Internal server error

--------------------------------------------------------------------------------

### `DELETE /api/orders/:orderId/acceptance`

Drop an ACCEPTED order. This action can only be done by the courier. 

```http
Authorization: Bearer <access-token>
```

#### Successful Response

```json
{
    "success": true,
    "message": "Order e94ee4b9-2839-4fbd-b80e-89d1a324b96e dropped by courier bfef7411-c83b-4299-82b9-20ab9c52106f",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": null,
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "OPEN",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 3,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:11:44.899Z",
        "acceptedAt": null,
        "pickedUpAt": null,
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`403`  | Caller does not have the permissions to perform this operation
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be dropped
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/pickup`

Mark an ACCEPTED order as PICKED_UP. This action can only be done by the assigned courier. 

```http
Authorization: Bearer <access-token>
```

#### Successful Response

```json
{
    "success": true,
    "message": "Order e94ee4b9-2839-4fbd-b80e-89d1a324b96e picked up by courier bfef7411-c83b-4299-82b9-20ab9c52106f",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": "bfef7411-c83b-4299-82b9-20ab9c52106f",
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "PICKED_UP",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 3,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:13:27.722Z",
        "acceptedAt": "2026-10-22T16:11:44.895Z",
        "pickedUpAt": "2026-10-22T16:13:27.719Z",
        "completedAt": null,
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`403`  | Caller does not have the permissions to perform this operation
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be picked up
`500`  | Internal server error


--------------------------------------------------------------------------------

### `POST /api/orders/:orderId/completion`

Mark a PICKED_UP order as COMPLETED. This action can only be done by the assigned courier.

```http
Authorization: Bearer <access-token>
```

#### Successful Response

```json
{
    "success": true,
    "message": "Order e94ee4b9-2839-4fbd-b80e-89d1a324b96e completed by courier bfef7411-c83b-4299-82b9-20ab9c52106f",
    "data": {
        "id": "e94ee4b9-2839-4fbd-b80e-89d1a324b96e",
        "requesterId": "5bb703e8-b4f5-4568-bb14-5a2bf9a392b0",
        "courierId": "bfef7411-c83b-4299-82b9-20ab9c52106f",
        "name": "test",
        "description": "test order",
        "pickupSupplierId": "3017fe6a-3577-4918-bbaa-9d91455bc38f",
        "deliverySupplierId": "acb4a28a-6cc9-4190-9106-f68f65a05fa9",
        "offeredCredits": 3,
        "remarks": "",
        "status": "COMPLETED",
        "expiryAt": "2026-10-23T15:53:00.000Z",
        "version": 4,
        "createdAt": "2026-10-22T16:07:40.471Z",
        "updatedAt": "2026-10-22T16:13:42.042Z",
        "acceptedAt": "2026-10-22T16:11:44.895Z",
        "pickedUpAt": "2026-10-22T16:13:27.719Z",
        "completedAt": "2026-10-22T16:13:42.037Z",
        "receivedAt": null,
        "canceledAt": null,
        "expiredAt": null,
        "failedAt": null,
        "cancellationReason": null,
        "failureReason": null,
        "creditReservationId": "eb4cf618-f517-433c-bb09-fe9acbe6fc25"
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------------------------
`200`  | Orders successfully queried
`400`  | Invalid request data
`403`  | Caller does not have the permissions to perform this operation
`404`  | Invalid orderId specified
`409`  | Order does not satisfy conditions for it to be completed
`500`  | Internal server error

--------------------------------------------------------------------------------

