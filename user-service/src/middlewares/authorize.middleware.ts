import type { NextFunction, Response } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import type { AuthenticatedRequest } from "../types/auth.types.js";

export function createAuthorizeAdmin(db: PrismaClient = prisma) {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      throw new AppError(
        "Authentication required",
        401,
        "AUTHENTICATION_REQUIRED",
      );
    }

    const actor = await db.user.findUnique({
      where: { userId: req.user.userId },
      select: { role: true },
    });

    if (actor?.role !== "ADMIN") {
      throw new AppError(
        "You do not have permission to access this resource",
        403,
        "ADMIN_REQUIRED",
      );
    }

    next();
  };
}

export const authorizeAdmin = createAuthorizeAdmin();
