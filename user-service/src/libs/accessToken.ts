import fs from "node:fs";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_EXPIRES_IN } from "../constants/auth.constants.js";
import config from "../config/config.js";

const privateKey = fs.readFileSync(config.jwtPrivateKeyPath, "utf8");

export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: string;
}

export function generateAccessToken(payload: AccessTokenPayload) {
    return jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
}