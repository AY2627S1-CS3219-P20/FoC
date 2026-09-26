import type { Response, NextFunction } from "express";
import { AppError } from "../errors/errors.js";
import type { AuthenticatedRequest } from "../types/auth.types.js";
import type { Role } from "../generated/prisma/client.js";

export function authorize(...allowedRoles: Role[]) {
    return (
        req: AuthenticatedRequest,
        _res: Response,
        next: NextFunction,
    ) => {
        if (!req.user) {
            throw new AppError("Authentication required", 401);
        }

        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError(
                "You do not have permission to access this resource",
                403
            );
        }

        next();
    };
}
