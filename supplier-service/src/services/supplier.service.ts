import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { Day } from "../generated/prisma/enums.js";
import type { CreateSupplierInput, UpdateSupplierInput, OpeningHoursInput } from "../schemas/supplier.schema.js";
import { AppError } from "../errors/errors.js";

export const STATUS = {
    ACTIVATED: "ACTIVATED",
    DEACTIVATED: "DEACTIVATED",
} as const;

function toPrismaTime(time: string): string {
    const padded = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
    return `2020-01-01T${padded}.000Z`;
}

function assertNoDuplicateDays(openingHours: OpeningHoursInput[] | undefined): void {
    const seen = new Set<string>();
    for (const hour of openingHours ?? []) {
        if (seen.has(hour.day)) {
            throw new AppError(
                `Duplicate opening hours for ${hour.day}`,
                400,
                "BAD_REQUEST",
            );
        }
        seen.add(hour.day);
    }
}

function mapOpeningHours(input: OpeningHoursInput[]) {
    return input.map((hour) => ({
        day: hour.day as Day,
        openingTime: toPrismaTime(hour.openingTime),
        closingTime: toPrismaTime(hour.closingTime),
    }));
}

async function ensureSupplierTypeExists(
    prisma: PrismaClient,
    type: string,
): Promise<void> {
    const supplierType = await prisma.supplierType.findUnique({
        where: { type },
    });

    if (!supplierType) {
        throw new AppError(
            `Supplier type "${type}" does not exist`,
            404,
            "NOT_FOUND",
        );
    }
}

async function findSupplierByName(
    prisma: PrismaClient,
    name: string,
): Promise<boolean> {
    const existing = await prisma.supplier.findMany({
        where: { name: { equals: name, mode: "insensitive" } },
    });

    return existing.length > 0;
}

export async function createSupplier(
    prisma: PrismaClient,
    input: CreateSupplierInput,
): Promise<Prisma.SupplierModel> {
    if (await findSupplierByName(prisma, input.name)) {
        throw new AppError(
            "A supplier with this name already exists",
            409,
            "CONFLICT",
        );
    }

    assertNoDuplicateDays(input.openingHours);

    await ensureSupplierTypeExists(prisma, input.type);

    return prisma.supplier.create({
        data: {
            name: input.name,
            type: input.type,
            status: STATUS.ACTIVATED,
            building: input.building ?? "N/A",
            floor: input.floor ?? 0,
            description: input.description,
            address: input.address,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            imageUrl: input.imageUrl ?? null,
            openingHours: {
                create: mapOpeningHours(input.openingHours ?? []),
            },
        },
        include: { openingHours: true },
    });
}

export async function updateSupplier(
    prisma: PrismaClient,
    id: string,
    input: UpdateSupplierInput,
): Promise<Prisma.SupplierModel> {
    const supplier = await prisma.supplier.findUnique({ where: { id } });

    if (!supplier) {
        throw new AppError("Supplier not found", 404, "NOT_FOUND");
    }

    if (input.openingHours !== undefined) {
        assertNoDuplicateDays(input.openingHours);
    }

    if (input.type !== undefined) {
        await ensureSupplierTypeExists(prisma, input.type);
    }

    if (input.name !== undefined && input.name.toLowerCase() !== supplier.name.toLowerCase()) {
        if (await findSupplierByName(prisma, input.name)) {
            throw new AppError(
                "A supplier with this name already exists",
                409,
                "CONFLICT",
            );
        }
    }

    const data: Prisma.SupplierUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.building !== undefined) data.building = input.building;
    if (input.floor !== undefined) data.floor = input.floor;
    if (input.description !== undefined) data.description = input.description;
    if (input.address !== undefined) data.address = input.address;
    if (input.latitude !== undefined) data.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude ?? null;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl ?? null;
    if (input.openingHours !== undefined) {
        data.openingHours = {
            deleteMany: {},
            create: mapOpeningHours(input.openingHours),
        };
    }

    if (Object.keys(data).length === 0) {
        throw new AppError(
            "No fields provided to update",
            400,
            "BAD_REQUEST",
        );
    }

    return prisma.supplier.update({
        where: { id },
        data,
        include: { openingHours: true },
    });
}
