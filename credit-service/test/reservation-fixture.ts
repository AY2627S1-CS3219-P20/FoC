import type { TestContext } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { abortReservation, getReservation, reserveCredits } from "../src/services/credit.service.js";

export async function reservationServices(_t: TestContext, database: PrismaClient) {
    return {
        reserveCredits: reserveCredits.bind(undefined, database),
        abortReservation: abortReservation.bind(undefined, database),
        getReservation: getReservation.bind(undefined, database),
    };
}
