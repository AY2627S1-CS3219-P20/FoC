// API response from server
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
}

// API error response from server
export interface ApiErrorResponse {
    success: false;
    code: string;
    message: string;
}

export interface ApiUser {
    id: string;
    email: string;
    username: string;
    phoneNumber: string;
    role: "student" | "admin";
}

// Authentication
export interface AuthData {
    user: ApiUser;
    accessToken: string;
}