import type { CreateRequestFormData } from "../schemas/create-request.schema";

export const ORDER_STATUSES = [
    "OPEN",
    "ACCEPTED",
    "PICKED_UP",
    "COMPLETED",
    "RECEIVED",
    "CANCELLED",
    "FAILED",
    "EXPIRED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
    id: string;
    requesterId: string;
    courierId: string | null;

    name: string;
    description: string;
    pickupSupplierId: string;
    deliverySupplierId: string;

    offeredCredits: number;
    status: OrderStatus;
    remarks: string | null;

    version: number;

    expiryAt: string;
    createdAt: string;
    updatedAt: string;

    acceptedAt: string | null;
    pickedUpAt: string | null;
    completedAt: string | null;
    receivedAt: string | null;
    cancelledAt: string | null;
    expiredAt: string | null;
    failedAt: string | null;

    cancellationReason: string | null;
    failureReason: string | null;
}

export type RequesterOrderHistoryParams = {
    page: number;
    limit: number;
    status?: OrderStatus;
    sortBy: SortBy;
    sortOrder: SortOrder;
};

export type RequesterOrderHistoryResponse = {
    orders: Order[];
    pagination: {
        limit: number;
        page: number;
        totalCount: number;
        totalPages: number;
    };
};

export type OrderRelatedUserDetails = {
    userId: string;
    username: string;
    email: string;
    phoneNumber: string;
};

export type OrderRelatedSupplierDetails = {
    id: string;
    name: string;
    type: string;
};

export type ViewerRole = "requester" | "courier";

export type SortBy = "createdAt" | "expiryAt";

export type SortOrder = "asc" | "desc";

export type UpdateRequestPayload = {
    orderId: string;
    expectedVersion: number;
    payload: CreateRequestFormData;
}