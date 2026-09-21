import argon2 from "argon2";
import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import { generateRefreshToken, verifyRefreshToken } from "../libs/refreshToken.js";
import { generateAccessToken } from "../libs/accessToken.js";
import { REFRESH_TOKEN_MAX_AGE } from "../constants/auth.constants.js";

export async function refreshAccessToken(refreshToken: string) {
    console.log("Refresh service running >>>>>>>>>>>>>>");
    // Verify the refresh token using jwt and the secret key
    const payload = verifyRefreshToken(refreshToken);
    console.log("Refresh token jti:", payload.jti);

    const storedToken = await prisma.refreshToken.findUnique({
        where: {
            tokenId: payload.jti,
        },
        include: {
            user: true,
        },
    });

    // Check if the refresh token exists and is valid
    if (!storedToken) {
        console.log("Refresh token not found in database");
        throw new AppError("Invalid token, please sign out and back in", 401);
    }

    // Check if the refresh token has been revoked
    if (storedToken.revokedAt) {
        console.log("The refresh token has been revoked. No more refresh token rotation.");
        throw new AppError("Invalid token, please sign out and back in", 401);
    }

    // Check if the refresh token has expired
    if (storedToken.expiresAt < new Date()) {
        console.log("The refresh token has expired. No more refresh token rotation.");
        throw new AppError("Invalid token, please sign out and back in", 401);
    }

    // Verify the refresh token against the stored hash
    const refreshTokenValid = await argon2.verify(storedToken.tokenHash, refreshToken);
    if (!refreshTokenValid) {
        console.log("The refresh token does not match the stored hash. No more refresh token rotation.");
        throw new AppError("Invalid token, please sign out and back in", 401);
    }

    // Refresh token is valid and exists in the database
    const user = storedToken.user;

    const revoked = await prisma.refreshToken.updateMany({
        where: {
            userId: user.userId,
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        }
    });

    console.log(`Revoked ${revoked.count} refresh token(s) for user ${user.userId}`);

    // Check if the refresh token was successfully revoked
    if (revoked.count !== 1) {
        console.log("Failed to revoke the refresh token. No more refresh token rotation.");
        throw new AppError("Invalid token, please sign out and back in", 401);
    }

    // Generate a new access token
    const newAccessToken = generateAccessToken({
        userId: user.userId,
        email: user.email,
        role: user.role,
    });

    // Generate a new refresh token
    const { refreshToken: newRefreshToken, tokenId: newTokenId } = generateRefreshToken(user.userId);
    const newTokenHash = await argon2.hash(newRefreshToken);

    // Store the new refresh token in the database
    await prisma.refreshToken.create({
        data: {
            tokenId: newTokenId,
            tokenHash: newTokenHash,
            userId: user.userId,
            expiresAt: new Date(
                Date.now() + REFRESH_TOKEN_MAX_AGE
            ),
        },
    });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
            id: user.userId,
            email: user.email,
            username: user.username,
            phoneNumber: user.phoneNumber,
            role: user.role,
        },
    }
}
