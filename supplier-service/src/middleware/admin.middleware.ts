import type { Response, NextFunction } from "express";
import { AppError } from "../errors/errors.js";
import type { AuthRequest } from "../types/auth.types.js";
import { ROLES } from "../constants/supplier.constants.js";

export function requireAdmin(
    req: AuthRequest,
    _res: Response,
    next: NextFunction,
): void {
    if (!req.user || req.user.role.toLowerCase() !== ROLES.ADMIN) {
        throw new AppError(
            "Administrator access required",
            403,
            "FORBIDDEN",
        );
    }

    next();
}
