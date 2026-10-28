import type { TestContext } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";

export async function reservationServices(t: TestContext, database: PrismaClient) {
    // Reservation services use a singleton; redirect transactions into this test's isolated schema.
    process.env.DATABASE_URL = process.env.CREDIT_TEST_DATABASE_URL!;
    process.env.PORT = "0";
    process.env.FRONTEND_URL = "http://localhost";
    process.env.JWT_PUBLIC_KEY_PATH = "unused-in-credit-tests.pem";
    process.env.ORDER_CREDIT_SERVICE_TOKEN = "test-token";
    const { prisma } = await import("../src/libs/prisma.js");
    const transaction = prisma.$transaction;
    prisma.$transaction = database.$transaction.bind(database);
    t.after(() => { prisma.$transaction = transaction; });
    return import("../src/services/reservation.service.js");
}
