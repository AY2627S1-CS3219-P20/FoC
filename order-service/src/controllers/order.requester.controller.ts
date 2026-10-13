import type { Response } from "express";
import { requesterOrderHistoryQuerySchema } from "../schemas/order.requester.schema.js";
import { getRequesterOrderHistoryService } from "../services/order.requester.service.js";
import { AppError } from "../errors/errors.js";
import type { AuthRequest } from "../types/auth.types.js";

export async function getRequesterOrderHistory(
    req: AuthRequest,
    res: Response,
) {
    const requesterId = req.user!.userId;
    const query = req.query;

    const parsedQuery = requesterOrderHistoryQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
        throw new AppError(parsedQuery.error.issues.at(0)?.message || "Invalid query", 400);
    }

    const result = await getRequesterOrderHistoryService(requesterId, parsedQuery.data);

    res.status(200).json({
        message: "Requester order history retrieved successfully",
        data: {
            orders: result.orders,
            pagination: result.pagination,
        },
    });
};