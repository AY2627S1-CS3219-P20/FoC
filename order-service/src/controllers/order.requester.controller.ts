import type { Response } from "express";
import { requesterOrderHistoryQuerySchema, updateRequestSchema,  } from "../schemas/order.requester.schema.js";
import { getRequesterOrderHistoryService, updateRequestService } from "../services/order.requester.service.js";
import { AppError } from "../errors/errors.js";
import type { AuthRequest } from "../types/auth.types.js";

export async function getRequesterOrderHistory(
    req: AuthRequest,
    res: Response,
) {
    const requesterId = req.user!.userId;
    if (!requesterId) {
        throw new AppError("Authentication required", 401);
    }

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

export async function updateRequest(
    req: AuthRequest,
    res: Response
) {
    const authorization = req.headers.authorization;
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const requesterId = req.user!.userId;
    if (!accessToken || !requesterId) {
        throw new AppError("Authentication required", 401);
    }

    const orderId = req.params.orderId;
    if (typeof orderId !== "string" || !orderId) {
        throw new AppError("Order id is required", 400);
    }

    const parsedBody = updateRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
        throw new AppError(parsedBody.error.issues.at(0)?.message || "Invalid request", 400);
    }

    const order = await updateRequestService(
        requesterId, orderId, parsedBody.data, accessToken
    );

    res.status(200).json({
        message: "Order updated successfully",
        data: order,
    });
};