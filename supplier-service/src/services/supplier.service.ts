import { AppError } from "../errors/errors.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { Day } from "../generated/prisma/enums.js";
import { prisma } from "../libs/prisma.js";
import type { CreateSupplierInput, OpeningHoursInput, UpdateSupplierInput } from "../schemas/supplier.schema.js";

export const STATUS = {
    ACTIVATED: "ACTIVATED",
    DEACTIVATED: "DEACTIVATED",
} as const;

function toPrismaTime(time: string): Date {
    const padded = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
    return new Date(`2020-01-01T${padded}`);
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

const LIMIT: number = 15; // only a max of 15 suppliers per page is displayed per page

// public fetch for the normal-user page: active suppliers only
// searchString and typeFilter are optional fields, which may or may not be supplied
export async function fetchActiveSuppliers(page: number, searchString?: string | null, typeFilter?: string | null) {
    const search = searchString ?? "";
    let type = "";
    if (typeFilter && typeFilter.toLowerCase() !== "all") {
        type = typeFilter;
    }
    const suppliers = await prisma.supplier.findMany({
        where: { 
            status: STATUS.ACTIVATED, 
            name: {
                contains: search, // enforce partial string match
                mode: 'insensitive', // enforce case insensitivity
            }, 
            type: {
                contains: type, // should return all types if typeFilter is empty
                mode: 'insensitive',
            }
        },
        include: { openingHours: true }, // also get opening hours of suppliers
        orderBy: { name: 'asc' }, // case-sensitive
        take: LIMIT, 
        skip: LIMIT * (page - 1),
    });

    if (!suppliers || suppliers.length == 0) {
        throw new AppError("No records found for this page", 400, "BAD_REQUEST");
    }

    return suppliers;
}

export async function countActiveSuppliers() {
    const count = await prisma.supplier.count({
        where: { 
            status: {
                equals: "ACTIVATED"
            }
        }
    });

    return count;
}

// this function returns all supplier types available
export async function fetchSupplierTypes() {
    const types = await prisma.supplierType.findMany({
        orderBy: { type: 'asc' }
    });

    return types;
}

// public fetch for the admin page: every supplier, including deactivated
export async function fetchAllSuppliers(page: number) {
    return fetchSuppliers(page);
}

// shared paginated fetch; callers supply an optional where clause
async function fetchSuppliers(
    page: number,
    where?: Prisma.SupplierWhereInput,
) {
    const args: Prisma.SupplierFindManyArgs = {
        include: { openingHours: true }, // also get opening hours of suppliers
        orderBy: { name: 'asc' }, // case-sensitive
        take: LIMIT,
        skip: LIMIT * (page - 1),
    };

    if (where) args.where = where;

    const suppliers = await prisma.supplier.findMany(args);

    if (!suppliers || suppliers.length == 0) {
        throw new AppError("No records found for this page", 400, "BAD_REQUEST");
    }

    return suppliers;
} 

// this function creates a new supplier type
export async function createType(type: string) {
    const duplicateType = await prisma.supplierType.findFirst({
        where: { 
            type: {
                equals: type,
                mode: 'insensitive',
            }
        }
    });

    if (duplicateType) { // this type already exists, throw error
        throw new AppError("This type already exists", 400, "BAD_REQUEST");
    }

    const newType = await prisma.supplierType.upsert({
        where: {
            type: type,
        },
        create: {
            type: type,
        },
        update: {}
    });

    return newType;
}

// this function deletes an existing supplier type, with no associated supplier record
export async function deleteType(type: string) {
    // there should only be one corresponding type found
    const typeToDelete = await prisma.supplierType.findFirst({
        where: { type: type },
    });

    if (!typeToDelete) {
        // could not find the type to be deleted, it does not exist
        throw new AppError("This type does not exist", 400, "BAD_REQUEST");
    }

    const associatedSuppliers = await prisma.supplier.findMany({
        where: { type: typeToDelete.type },
    });
    // console.log(associatedSuppliers)
    
    if (associatedSuppliers.length > 0) {
        // there are suppliers to the type that the user wants to delete
        throw new AppError("There are suppliers associated to this type, hence it cannot be deleted", 403);
    }

    const deletedType = await prisma.supplierType.delete({
        where: { id: typeToDelete.id }
    });

    return deletedType;
}
