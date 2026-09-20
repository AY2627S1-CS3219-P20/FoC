import crypto from "node:crypto";
import jwt, { type Secret } from "jsonwebtoken";
import { REFRESH_TOKEN_EXPIRES_IN } from "../constants/auth.constants.js";
import config from "../config/config.js";

const key: Secret = config.jwtRefreshTokenKey;

export interface RefreshTokenPayload {
    userId: string;
    jti: string;
}

export function generateRefreshToken(userId: string) {
    const tokenId = crypto.randomUUID();

    const refreshToken = jwt.sign(
        {
            userId,
        },
        key,
        {
            jwtid: tokenId,
            algorithm: "HS256",
            expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        },
    );

    return {
        refreshToken,
        tokenId,
    };
}