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

export interface ApiSupplierResponse {
    data: SupplierRecord[]
}

// Authentication
export interface AuthData {
    user: ApiUser;
    accessToken: string;
}

// Supplier Records
export interface OpeningHours {
    id: string;
    supplierId: string;
    day: string;
    openingTime: Date;
    closingTime: Date;
}

export interface SupplierRecord {
    id: string;
    name: string;
    type: string;
    status: "ACTIVATED" | "DEACTIVATED";
    building: string;
    floor: number;
    description: string;
    address: string;
    openingHours: OpeningHours[];
    latitude: number | null;
    longitude: number | null;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
}