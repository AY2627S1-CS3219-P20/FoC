import type { Response } from "express";
import { AppError } from "../errors/errors.js";
import {
  resendEmailChangeOtpSchema,
  startEmailChangeSchema,
  updateMyProfileSchema,
  verifyEmailChangeSchema,
} from "../schemas/user.schema.js";
import {
  getPendingEmailChange,
  resendEmailChangeOtp as resendEmailChangeOtpService,
  startEmailChange as startEmailChangeService,
  verifyEmailChange as verifyEmailChangeService,
} from "../services/email-change.service.js";
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
  const userId = getAuthenticatedUserId(req);
  const [user, pendingEmailChange] = await Promise.all([
    getMyProfileService(userId),
    getPendingEmailChange(userId),
  ]);

  return res.status(200).json({
    success: true,
    data: { user, pendingEmailChange },
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

export async function startEmailChange(
  req: AuthenticatedRequest,
  res: Response,
) {
  const result = startEmailChangeSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(
      result.error.issues.at(0)?.message || "Invalid request",
      400,
    );
  }

  const data = await startEmailChangeService(
    getAuthenticatedUserId(req),
    result.data,
  );

  return res.status(202).json({
    success: true,
    data,
  });
}

export async function resendEmailChangeOtp(
  req: AuthenticatedRequest,
  res: Response,
) {
  const result = resendEmailChangeOtpSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(
      result.error.issues.at(0)?.message || "Invalid request",
      400,
    );
  }

  const data = await resendEmailChangeOtpService(
    getAuthenticatedUserId(req),
    result.data,
  );

  return res.status(202).json({
    success: true,
    data,
  });
}

export async function verifyEmailChange(
  req: AuthenticatedRequest,
  res: Response,
) {
  const result = verifyEmailChangeSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(
      result.error.issues.at(0)?.message || "Invalid request",
      400,
    );
  }

  const user = await verifyEmailChangeService(
    getAuthenticatedUserId(req),
    result.data,
  );

  return res.status(200).json({
    success: true,
    data: { user },
  });
}
