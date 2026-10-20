import type { Request, Response } from "express";
import { AppError } from "../errors/errors.js";
import {
    abortReservation,
    getReservation,
    renewReservation,
    reserveCredits,
} from "../services/reservation.service.js";
import {
    abortReservationSchema,
    renewReservationSchema,
    reservationIdSchema,
    reservationSchema,
} from "../schemas/reservation.schema.js";

export const createReservationController = async (
    req: Request, res: Response
) => {
    const parsedBody = reservationSchema.safeParse(req.body);

    if (!parsedBody.success) {
        throw new AppError("Invalid reservation", 400);
    }

    const result = await reserveCredits(parsedBody.data);

    res.status(result.created ? 201 : 200).json({
        success: true,
        data: result.reservation,
    });
};

export const getReservationController = async (
    req: Request, res: Response
) => {
    const parsedId = reservationIdSchema.safeParse(req.params.reservationId);

    if (!parsedId.success) {
        throw new AppError("Invalid reservation ID", 400);
    }

    const reservation = await getReservation(parsedId.data);

    res.status(200).json({
        success: true,
        data: reservation,
    });
};

export const abortReservationController = async (
    req: Request, res: Response
) => {
    const parsedId = reservationIdSchema.safeParse(req.params.reservationId);
    const parsedBody = abortReservationSchema.safeParse(req.body);

    if (!parsedId.success || !parsedBody.success) {
        throw new AppError("Invalid reservation", 400);
    }

    if (parsedId.data !== parsedBody.data.reservationId) {
        throw new AppError("Reservation ID does not match request body", 400);
    }

    const result = await abortReservation(parsedBody.data);

    res.status(200).json({
        success: true,
        data: result.reservation,
    });
};

export const renewReservationController = async (
    req: Request, res: Response
) => {
    const parsedBody = renewReservationSchema.safeParse(req.body);

    if (!parsedBody.success) {
        throw new AppError("Invalid reservation", 400);
    }

    const result = await renewReservation(parsedBody.data);

    res.status(result.created ? 201 : 200).json({
        success: true,
        data: result.reservation,
    });
}