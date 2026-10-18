export type ReservationPayload = {
    orderId: string;
    requesterId: string;
    amount: number;
};

export type AbortReservationPayload = ReservationPayload & {
    reservationId: string;
};

export type ReservationStatus =
    | "RESERVED"
    | "TRANSFERRED"
    | "RELEASED"
    | "REFUNDED"
    | "ABORTED";

export type SettlementReason =
    | "RECEIVED"
    | "CANCELED"
    | "EXPIRED"
    | "FAILED"
    | "CREATION_ABORTED";

export type CreditReservation = {
    id: string;
    orderId: string;
    requesterId: string;
    amount: number;
    status: ReservationStatus;
    courierId: string | null;
    settlementEventId: string | null;
    settlementReason: SettlementReason | null;
    settlementPayload: unknown | null;
    createdAt: string;
    updatedAt: string;
    settledAt: string | null;
    accountId: string | null;
};

export type CreditReservationResponse = {
    success: boolean;
    data: CreditReservation;
};