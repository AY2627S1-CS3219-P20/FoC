import type { Response } from "express";
import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import { getCreditBalance } from "../services/credit.service.js";
import type { AuthRequest } from "../types/auth.types.js";
import type { BalanceResponse } from "../types/credit.types.js";

export async function getMyBalance(req: AuthRequest, res: Response<BalanceResponse>) {
    if (!req.user) throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    if (Object.keys(req.query).length > 0) {
        throw new AppError("Invalid query parameters", 400);
    }

    const data = await getCreditBalance(prisma, req.user.userId);
    if (data.status === "PROVISIONING") {
        return res.status(202).json({ success: true, data });
    }
    return res.status(200).json({ success: true, data });
}
