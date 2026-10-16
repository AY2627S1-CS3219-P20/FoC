import { createHash, timingSafeEqual } from "node:crypto";
import express, { Router, type ErrorRequestHandler } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import { abortReservationSchema, reservationIdSchema } from "../schemas/reservation.schema.js";
import { reserveCredits, abortReservation, getReservation } from "../services/reservation.service.js";

export function createInternalCreditRouter(prisma: PrismaClient, getToken: () => string | undefined) {
    const router = Router();
    router.use((req, _res, next) => {
        const token = getToken();
        const hash = (value: string) => createHash("sha256").update(value).digest();
        if (!token || !req.headers.authorization || !timingSafeEqual(hash(req.headers.authorization), hash(`Bearer ${token}`))) {
            throw new AppError("Service authentication required", 401);
        }
        next();
    });
    router.use(express.json());
    const parseError: ErrorRequestHandler = (error, _req, _res, next) => {
        next(error?.type === "entity.parse.failed" ? new AppError("Invalid JSON body", 400) : error);
    };
    router.use(parseError);
    router.post("/reservations", async (req, res) => {
        const result = await reserveCredits(prisma, req.body);
        res.status(201).json({ success: true, data: result.reservation });
    });
    router.get("/reservations/:reservationId", async (req, res) => {
        res.json({ success: true, data: await getReservation(prisma, req.params.reservationId) });
    });
    router.post("/reservations/:reservationId/abort", async (req, res) => {
        const id = reservationIdSchema.safeParse(req.params.reservationId);
        const input = abortReservationSchema.safeParse(req.body);
        if (!id.success || !input.success || id.data !== input.data.reservationId) throw new AppError("Invalid reservation", 400);
        const result = await abortReservation(prisma, input.data);
        res.status(200).json({ success: true, data: result.reservation });
    });
    return router;
}
