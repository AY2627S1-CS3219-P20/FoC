import type { Request } from "express";
import type { Role } from "../generated/prisma/client.js";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
