import type { Request, Response } from "express";
import { AppError } from "../errors/errors.js";
import type { AuthRequest } from "../types/auth.types.js";
import { getOpenOrdersSchema } from "../schemas/order.courier.schema.js";
import { getAllOpenOrders } from "../services/order.courier.service.js";

export async function getOpenOrders(req: AuthRequest, res: Response) {
    const courierId = req.user!.userId;
    const query = req.query;

    const request = getOpenOrdersSchema.safeParse(query);
    if (!request.success) {
        throw new AppError(request.error.issues.at(0)?.message || "Invalid query", 400);
    }
    const orders = await getAllOpenOrders(courierId, request.data);

    return res.status(200).json({
        success: true,
        data: {
            message: `All orders on page ${request.data.page} retrieved`,
            data: orders,
        },
    });
}