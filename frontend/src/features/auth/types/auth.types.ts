import type { ApiUser } from "@/types/api.types";

export interface LoginPayload {
    email: string;
    password: string;
}

export interface AuthResult {
    user: ApiUser;
    accessToken: string;
}