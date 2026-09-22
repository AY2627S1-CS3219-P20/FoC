export interface ApiSupplierResponse {
    data: SupplierRecord[]
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