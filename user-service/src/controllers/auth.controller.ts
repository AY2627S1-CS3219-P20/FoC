import type { Request, Response } from "express";
import { loginSchema } from "../schemas/auth.schema.js";
import { loginUser } from "../services/auth.service.js";
import { AppError } from "../errors/errors.js";
import { logoutUser, refreshAccessToken } from "../services/refresh.service.js";
import { refreshTokenCookieOptions } from "../libs/cookies.js";

export async function login(req: Request, res: Response) {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        throw new AppError(result.error.issues.at(0)?.message || "Invalid request", 400);
    }
    const data = await loginUser(result.data);
    console.log("Login successful:", data);

    res.cookie("refreshToken", data.refreshToken, refreshTokenCookieOptions);

    return res.status(200).json({
        success: true,
        data: {
            accessToken: data.accessToken,
            user: data.user,
        },
    });
}
