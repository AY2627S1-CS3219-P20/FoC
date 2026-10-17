import type { RequestHandler } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { reserveCredits } from "../services/reservation.service.js";

export function createReservationController(prisma: PrismaClient): RequestHandler {
    return async (req, res) => {
        const result = await reserveCredits(prisma, req.body);
        res.status(201).json({ success: true, data: result.reservation });
    };
}
