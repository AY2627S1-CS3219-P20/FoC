# User Service

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Security](#security)
- [Acknowledgements](#acknowledgements)

## About

The User Service is responsible for user account management, authentication, authorization, and JWT token management for **Aaron**.

It manages user accounts and provides authentication services to the other microservices in the system.

## Features

### Authentication & Authorization

- User registration and login
- JWT-based authentication
- RS256 access tokens
- Refresh token rotation
- Refresh token revocation
- HttpOnly refresh token cookies
- Role-based access control
- Protected user and admin endpoints

### User Management

- User account management
- User profile management

### Security & Validation

- Password hashing and verification using Argon2
- Case-sensitive password verification
- Case-insensitive email matching
- Request validation using Zod
- Centralized error handling

### Database

- PostgreSQL database
- Prisma ORM for database management

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
Argon2        | Password hashing
Cookie Parser | Cookie handling
CORS          | Cross-origin resource sharing
Nodemailer    | Email sending

## Architecture

The User Service is one of the backend microservices in Aaron.

```text
┌──────────────────────┐
│      Frontend        │
│   React + TypeScript │
└──────────┬───────────┘
           │
           │ REST API
           ▼
┌──────────────────────────────────────────────┐
│           User Service                       │
│                                              │
│  ┌──────────────┐  ┌──────────────┐          │
│  │    Routes    │→ │ Controllers  │          │
│  └──────────────┘  └──────┬───────┘          │
│                           │                  │
│                    ┌──────▼───────┐          │
│                    │   Services   │          │
│                    └──────┬───────┘          │
│                           │                  │
│              ┌────────────┴───────┐          │
│              │                    │          │
│       ┌──────▼─────────┐    ┌─────▼────────┐ │
│       │ Authentication │    │  Auth & User │ │
│       │ & Authorization│    │  Management  │ │
│       └──────┬─────────┘    └─────┬────────┘ │
│              │                    │          │
│       ┌──────▼────────┐           │          │
│       │ JWT / Refresh │           │          │
│       │ Token Logic   │           │          │
│       └───────────────┘           │          │
│                                   │          │
│                         ┌─────────▼────┐     │
│                         │ Prisma ORM   │     │
│                         └───────┬──────┘     │
└─────────────────────────────────┼────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   PostgreSQL    │
                         │   users         │
                         └─────────────────┘
```

### Authentication

The User Service issues access and refresh tokens.

- **Access tokens** use RS256 and are signed using the User Service's private key.
- Other microservices verify access tokens using the corresponding public key.
- **Refresh tokens** are managed only by the User Service.
- Refresh tokens are stored in the database as Argon2 hashes.
- Refresh tokens are rotated after successful use.

### Database

The User Service has its own PostgreSQL database.

```text
User Service
     │
     ▼
  PostgreSQL
     │
     ├── User
     │
     └── RefreshToken
```

Other microservices do not directly access the User Service database. Cross-service references use the user's user id.

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
│   ├── libs/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── types/
│   └── index.ts
│
├── keys/
├── .env
├── .env.example
├── .gitignore
|── AGENTS.md
|── Dockerfile
|── package-lock.json
├── package.json
├── prisma.config.ts
|── README.md
└── tsconfig.json
```

## API Reference

The User Service exposes REST APIs under the `/api` prefix.

### Authentication

Method | Endpoint             | Authentication | Description
------ | -------------------- | -------------- | --------------------------------
`POST` | `/api/auth/register` | Public         | Register a new user
`POST` | `/api/auth/login`    | Public         | Authenticate a user
`POST` | `/api/auth/refresh`  | Refresh Token  | Generate a new access token
`POST` | `/api/auth/logout`   | Refresh Token  | Revoke the current refresh token

### User Management

Method | Endpoint             | Authentication | Description
------ | -------------------- | -------------- | -------------------------------------------------------
`GET`  | `/api/users/me`      | Authenticated  | Retrieve the currently authenticated user's information
`PUT`  | `/api/users/me`      | Authenticated  | Update the currently authenticated user's information
`GET`  | `/api/users`         | Admin          | Retrieve users
`PUT`  | `/api/users/:userId` | Admin          | Update a user's information

--------------------------------------------------------------------------------

### `POST /api/auth/register`

Registers a new student account.

#### Request Body

```json
{
    "email": "student@example.com",
    "username": "student123",
    "phoneNumber": "91234567",
    "password": "Password123!"
}
```

#### Successful Response

```json
{
    "success": true,
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "student@example.com",
        "username": "student123",
        "phoneNumber": "91234567",
        "role": "STUDENT"
    }
}
```

#### Possible Responses

Status | Description
------ | -----------------------------------------------
`201`  | User successfully registered
`400`  | Invalid request data
`409`  | Email, username, or phone number already exists
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/auth/login`

Authenticates a user and issues an access token and refresh token.

#### Request Body

```json
{
    "email": "student@example.com",
    "password": "Password123!"
}
```

#### Successful Response

```json
{
    "success": true,
    "data": {
        "accessToken": "<access-token>",
        "user": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "student@example.com",
            "username": "student123",
            "phoneNumber": "91234567",
            "role": "STUDENT"
        }
    }
}
```

The refresh token is returned using an `HttpOnly` cookie.

#### Possible Responses

Status | Description
------ | ----------------------------------
`200`  | Login successfully
`400`  | Invalid request data
`401`  | Invalid email or password provided
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/auth/refresh`

Generates a new access token using the refresh token stored in the request cookie.

#### Request

No request body is required.

The refresh token must be provided through the authentication cookie.

#### Successful Response

```json
{
    "success": true,
    "data": {
        "accessToken": "<new-access-token>",
        "user": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "student@example.com",
            "username": "student123",
            "phoneNumber": "91234567",
            "role": "STUDENT"
        }
    }
}
```

A new refresh token is also issued through the `HttpOnly` cookie.

#### Possible Responses

Status | Description
------ | ------------------------------------------
`200`  | Token refreshed successfully
`401`  | Invalid token, please sign out and back in
`500`  | Internal server error

--------------------------------------------------------------------------------

### `POST /api/auth/logout`

Revokes the current refresh token and clears the authentication cookie.

#### Request

No request body is required.

The refresh token must be provided through the authentication cookie.

#### Successful Response

```json
{
    "success": true,
    "message": "Logged out successfully"
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------
`200`  | Logged out successfully
`401`  | Invalid token, please sign out and back in
`500`  | Internal server error

--------------------------------------------------------------------------------

### `GET /api/users/me`

Retrieves information about the currently authenticated user.

#### Headers

```http
Authorization: Bearer <access-token>
```

#### Successful Response

```json
{
    "success": true,
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "student@example.com",
        "username": "student123",
        "phoneNumber": "91234567",
        "role": "STUDENT"
    }
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------
`200`  | User information retrieved successfully
`401`  | Invalid token, please sign out and back in
`404`  | User not found
`500`  | Internal server error

--------------------------------------------------------------------------------

### `PUT /api/users/me`

Updates information belonging to the currently authenticated user.

#### Headers

```http
Authorization: Bearer <access-token>
```

#### Request Body

```json
{
    "username": "newUsername",
    "phoneNumber": "98765432"
}
```

Only the fields that need to be changed need to be included.

#### Successful Response

```json
{
    "success": true,
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "student@example.com",
        "username": "newUsername",
        "phoneNumber": "98765432",
        "role": "STUDENT"
    }
}
```

#### Possible Responses

Status | Description
------ | ------------------------------------------
`200`  | User information updated successfully
`400`  | Invalid request data
`401`  | Invalid token, please sign out and back in
`409`  | Username or phone number already exists
`500`  | Internal server error

--------------------------------------------------------------------------------

### `GET /api/users`

Retrieves users for administrative management.

#### Headers

```http
Authorization: Bearer <admin-access-token>
```

#### Query Parameters

```text
?page=1&limit=10&search=john&role=STUDENT
```

Parameter | Type   | Required | Description
--------- | ------ | -------- | --------------------------
`page`    | number | No       | Page number
`limit`   | number | No       | Number of users per page
`search`  | string | No       | Search by user information
`role`    | string | No       | Filter by user role

#### Successful Response

```json
{
    "success": true,
    "data": {
        "items": [],
        "pagination": {
            "page": 1,
            "limit": 10,
            "totalItems": 25,
            "totalPages": 3
        }
    }
}
```

#### Possible Responses

Status | Description
------ | --------------------------------------------------
`200`  | Users retrieved successfully
`401`  | Invalid token, please sign out and back in
`403`  | You do not have permission to access this resource
`500`  | Internal server error

--------------------------------------------------------------------------------

### `PUT /api/users/:userId`

Allows an administrator to update another user's information.

#### Headers

```http
Authorization: Bearer <admin-access-token>
```

#### Path Parameters

Parameter | Type | Description
--------- | ---- | ------------------------
`userId`  | UUID | ID of the user to update

#### Request Body

```json
{
    "username": "updatedUsername",
    "phoneNumber": "98765432",
    "role": "STUDENT"
}
```

#### Successful Response

```json
{
    "success": true,
    "data": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "student@example.com",
        "username": "updatedUsername",
        "phoneNumber": "98765432",
        "role": "STUDENT"
    }
}
```

#### Possible Responses

Status | Description
------ | --------------------------------------------------
`200`  | User updated successfully
`400`  | Invalid request data
`401`  | Invalid token, please sign out and back in
`403`  | You do not have permission to access this resource
`404`  | User not found
`409`  | Username or phone number already exists
`500`  | Internal server error

--------------------------------------------------------------------------------

### Error Response Format

All API errors follow the same response format:

```json
{
    "success": false,
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
}
```

Common error codes include:

Code                    | HTTP Status | Description
----------------------- | ----------: | ----------------------------------
`BAD_REQUEST`           |       `400` | Invalid request
`UNAUTHORIZED`          |       `401` | Authentication required or invalid
`FORBIDDEN`             |       `403` | Insufficient permissions
`NOT_FOUND`             |       `404` | Resource not found
`CONFLICT`              |       `409` | Resource already exists
`INTERNAL_SERVER_ERROR` |       `500` | Unexpected server error

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- PostgreSQL

### Installation

Clone the repository and navigate to the User Service:

```bash
cd user-service
```

Install the dependencies:

```bash
npm install
```

### Database Setup

Make sure your local PostgreSQL database is running and that the `DATABASE_URL` in your `.env` file points to the correct database.

Apply the existing Prisma migrations:

```bash
npx prisma migrate deploy
```

Generate the Prisma Client:

```bash
npx prisma generate
```

### Running the Service

Run the service in development mode:

```bash
npm run dev
```

The User Service runs on:

```text
http://localhost:3000
```

### Prisma Studio

To inspect the local database:

```bash
npx prisma studio
```

## Configuration

Create a `.env` file in the root of the User Service.

Example:

```env
PORT=3000

NODE_ENV=development

FRONTEND_URL="http://localhost:5173"

DATABASE_URL="postgresql://username:password@localhost:5432/users"

JWT_PRIVATE_KEY_PATH="./keys/private.pem"

JWT_PUBLIC_KEY_PATH="./keys/public.pem"

JWT_REFRESH_TOKEN_KEY="your_refresh_token_secret_here"

COOKIE_SECRET="your_cookie_secret_here"
```

### Environment Variables

Variable                | Description
----------------------- | ------------------------------------------------------
`PORT`                  | Port used by the User Service
`NODE_ENV`              | Node environment (development, production, etc.)
`FRONTEND_URL`          | Frontend URL allowed by CORS
`DATABASE_URL`          | PostgreSQL connection string
`JWT_PRIVATE_KEY_PATH`  | Path to the RSA private key used to sign access tokens
`JWT_PUBLIC_KEY_PATH`   | Path to the RSA public key used to verify access tokens
`JWT_REFRESH_TOKEN_KEY` | Secret used to sign refresh tokens
`COOKIE_SECRET`         | Secret used for cookie signing

> Do not commit `.env`, private keys, or other secrets to the repository.

## Security

### Password Security

Passwords are hashed using **Argon2** before being stored in the database.

Plaintext passwords are never stored.

```text
User Password
      │
      ▼
    Argon2
      │
      ▼
Password Hash
      │
      ▼
 PostgreSQL
```

During login, the submitted password is verified against the stored hash.

### Email Matching

Email matching is case-insensitive.

For example:

```text
John@example.com
john@example.com
JOHN@EXAMPLE.COM
```

are treated as the same email address.

Email addresses are normalized before being stored or queried:

```typescript
email.trim().toLowerCase()
```

Passwords are **not** normalized. Password verification remains case-sensitive.

### Access Tokens

Access tokens use the RS256 algorithm.

The User Service signs access tokens using its private key:

```text
User Service
     │
     │ Private Key
     ▼
Access Token
     │
     ▼
Other Microservice
     │
     │ Public Key
     ▼
Token Verification
```

This allows other services to verify authentication locally without making a request to the User Service for every API request.

### Refresh Tokens

Refresh tokens:

- Are stored in an HttpOnly cookie.
- Are stored as Argon2 hashes in the database.
- Have an expiration time.
- Are revoked after successful use.
- Are rotated when a new access token is issued.
- Cannot be reused after being revoked.

## Acknowledgements

- [Express](https://expressjs.com/)
- [Prisma](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [Zod](https://zod.dev/)
- [Argon2](https://www.npmjs.com/package/argon2)
- [JSON Web Token](https://jwt.io/)
