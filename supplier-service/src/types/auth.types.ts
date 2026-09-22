import type { Request } from "express";

export interface AuthenticatedUser {
    userId: string;
    email: string;
    role: string;
}

export interface AuthRequest extends Request {
    user?: AuthenticatedUser;
}