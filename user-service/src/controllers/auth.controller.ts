import type { Request, Response } from "express";
import { loginSchema } from "../schemas/auth.schema.js";
import { loginUser, logoutUser } from "../services/auth.service.js";
import { AppError } from "../errors/errors.js";
import { refreshAccessToken } from "../services/refresh.service.js";
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

export async function logout(req: Request, res: Response) {
    const refreshToken = req.signedCookies.refreshToken;

    // Clear the refresh token cookie
    res.clearCookie("refreshToken", refreshTokenCookieOptions);

    if (refreshToken) {
        try {
            await logoutUser(refreshToken);
            console.log("Logout successful");
        } catch (error) {
            console.error("Error during logout:", error);
            // Even if there's an error during logout, we still want
            // to clear the cookie and log the user out.
        }
    }
    return res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
}

export async function refresh(req: Request, res: Response) {
    const refreshToken = req.signedCookies.refreshToken;
    console.log("Refresh token received:", refreshToken);

    // Check if the refresh token is present in the cookies
    if (!refreshToken) {
        console.log("No refresh token found in cookies");
        throw new AppError("Invalid, please sign out and back in", 401);
    }

    const result = await refreshAccessToken(refreshToken);
    res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);
    console.log("Refresh token rotation successful");

    return res.status(200).json({
        success: true,
        data: {
            accessToken: result.accessToken,
            user: result.user,
        },
    });
}