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

// Supplier
export type SupplierDay =
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";

export type SupplierStatus = "ACTIVATED" | "DEACTIVATED";

export interface SupplierOpeningHours {
    id: string;
    supplierId: string;
    day: SupplierDay;
    openingTime: string;
    closingTime: string;
}

export interface Supplier {
    id: string;
    name: string;
    type: string;
    status: SupplierStatus;
    building: string;
    floor: number;
    description: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    openingHours: SupplierOpeningHours[];
}

export interface SupplierType {
    id: string;
    type: string;
}

export interface SupplierTypeCount {
    id: string;
    type: string;
    count: number;
}

export interface CreateSupplierInput {
    name: string;
    type: string;
    building?: string | null;
    floor?: number | null;
    description: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
    openingHours?: Array<{ day: SupplierDay; openingTime: string; closingTime: string }>;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;
