import type { Response } from "express";
import { AppError } from "../errors/errors.js";
import { updateMyProfileSchema } from "../schemas/user.schema.js";
import {
  getMyProfile as getMyProfileService,
  updateMyProfile as updateMyProfileService,
} from "../services/user.service.js";
import type { AuthenticatedRequest } from "../types/auth.types.js";

function getAuthenticatedUserId(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
  }

  return req.user.userId;
}

export async function getMyProfile(req: AuthenticatedRequest, res: Response) {
  const user = await getMyProfileService(getAuthenticatedUserId(req));

  return res.status(200).json({
    success: true,
    data: { user },
  });
}

export async function updateMyProfile(req: AuthenticatedRequest, res: Response) {
  const result = updateMyProfileSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(
      result.error.issues.at(0)?.message || "Invalid request",
      400,
    );
  }

  const user = await updateMyProfileService(
    getAuthenticatedUserId(req),
    result.data,
  );

  return res.status(200).json({
    success: true,
    data: { user },
  });
}
