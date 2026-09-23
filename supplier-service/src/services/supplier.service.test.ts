import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
    createSupplier,
    updateSupplier,
} from "../services/supplier.service.js";
import { AppError } from "../errors/errors.js";
import type { CreateSupplierInput } from "../schemas/supplier.schema.js";

type SupplierData = {
    name: string;
    type: string;
    status: string;
    latitude: number;
    floor: number;
    openingHours: {
        create: Array<{ day: string }>;
        deleteMany?: unknown;
    };
};

const MOCK_SUPPLIER = {
    id: "sup_1",
    name: "Starbucks",
    type: "FOOD",
    status: "ACTIVATED",
    building: "Engineering Building",
    floor: 1,
    description: "Coffee and pastries",
    address: "4 Engineering Road",
    latitude: 1.3,
    longitude: 103.77,
    imageUrl: null,
    openingHours: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};

const validCreateInput: CreateSupplierInput = {
    name: "Starbucks",
    type: "FOOD",
    building: "Engineering Building",
    floor: 1,
    description: "Coffee and pastries",
    address: "4 Engineering Road",
    latitude: 1.3,
    longitude: 103.77,
    imageUrl: null,
    openingHours: [
        { day: "MONDAY", openingTime: "08:00", closingTime: "18:00" },
        { day: "TUESDAY", openingTime: "08:00", closingTime: "18:00" },
    ],
};

interface MockConfig {
    findManyReturn?: unknown[];
    supplierFindUnique?: unknown | null;
    typeFindUnique?: unknown | null;
    createReturn?: unknown;
    updateReturn?: unknown;
}

function createMockPrisma(config: MockConfig = {}) {
    const calls = {
        findMany: 0,
        findUnique: 0,
        typeFindUnique: 0,
        create: 0,
        update: 0,
    };

    const captured = {
        createArgs: undefined as unknown,
        updateArgs: undefined as unknown,
    };

    const prisma = {
        supplier: {
            findMany: mock.fn(async () => {
                calls.findMany++;
                return config.findManyReturn ?? [];
            }),
            findUnique: mock.fn(async () => {
                calls.findUnique++;
                return config.supplierFindUnique ?? null;
            }),
            create: mock.fn(async (args: unknown) => {
                calls.create++;
                captured.createArgs = args;
                return config.createReturn ?? config.supplierFindUnique ?? {};
            }),
            update: mock.fn(async (args: unknown) => {
                calls.update++;
                captured.updateArgs = args;
                return config.updateReturn ?? config.supplierFindUnique ?? {};
            }),
        },
        supplierType: {
            findUnique: mock.fn(async () => {
                calls.typeFindUnique++;
                return config.typeFindUnique ?? null;
            }),
        },
    };

    return { prisma: prisma as unknown as PrismaClient, calls, captured };
}

test("createSupplier rejects a duplicate (case-insensitive) name", async () => {
    const { prisma, calls } = createMockPrisma({
        findManyReturn: [MOCK_SUPPLIER],
    });

    await assert.rejects(
        () => createSupplier(prisma, validCreateInput),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 409);
            return true;
        },
    );

    assert.equal(calls.create, 0);
});

test("createSupplier rejects an unknown supplier type", async () => {
    const { prisma, calls } = createMockPrisma({ typeFindUnique: null });

    await assert.rejects(
        () => createSupplier(prisma, validCreateInput),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 404);
            return true;
        },
    );

    assert.equal(calls.create, 0);
});

test("createSupplier stores a new supplier as ACTIVATED with its opening hours", async () => {
    const { prisma, calls, captured } = createMockPrisma({
        typeFindUnique: { type: "FOOD" },
        createReturn: MOCK_SUPPLIER,
    });

    const result = await createSupplier(prisma, validCreateInput);

    assert.equal(result.name, "Starbucks");
    assert.equal(calls.create, 1);

    const data = (captured.createArgs as { data: SupplierData }).data;
    assert.equal(data.name, "Starbucks");
    assert.equal(data.type, "FOOD");
    assert.equal(data.status, "ACTIVATED");
    assert.equal(data.latitude, 1.3);
    assert.equal(data.openingHours.create.length, 2);
    assert.equal(data.openingHours.create[0]!.day, "MONDAY");
});

test("updateSupplier returns 404 for an unknown supplier", async () => {
    const { prisma, calls } = createMockPrisma({ supplierFindUnique: null });

    await assert.rejects(
        () => updateSupplier(prisma, "missing", { name: "New name" }),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 404);
            return true;
        },
    );

    assert.equal(calls.update, 0);
});

test("updateSupplier rejects an unknown type on change", async () => {
    const { prisma, calls } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "ACTIVATED" },
        typeFindUnique: null,
    });

    await assert.rejects(
        () => updateSupplier(prisma, "sup_1", { type: "UNKNOWN" }),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 404);
            return true;
        },
    );

    assert.equal(calls.update, 0);
});

test("updateSupplier rejects a name that collides with another supplier", async () => {
    const { prisma, calls } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "ACTIVATED" },
        typeFindUnique: { type: "FOOD" },
        findManyReturn: [{ ...MOCK_SUPPLIER, id: "sup_2", name: "Costa" }],
    });

    await assert.rejects(
        () => updateSupplier(prisma, "sup_1", { name: "Costa" }),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 409);
            return true;
        },
    );

    assert.equal(calls.update, 0);
});

test("updateSupplier rejects an empty payload", async () => {
    const { prisma, calls } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "ACTIVATED" },
    });

    await assert.rejects(
        () => updateSupplier(prisma, "sup_1", {}),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 400);
            return true;
        },
    );

    assert.equal(calls.update, 0);
});

test("updateSupplier changes scalar fields and replaces opening hours", async () => {
    const { prisma, calls, captured } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "ACTIVATED" },
        updateReturn: { ...MOCK_SUPPLIER, name: "Starbucks Rebranded", floor: 5 },
    });

    const result = await updateSupplier(prisma, "sup_1", {
        name: "Starbucks Rebranded",
        floor: 5,
        openingHours: [{ day: "FRIDAY", openingTime: "09:00", closingTime: "17:00" }],
    });

    assert.equal(result.name, "Starbucks Rebranded");
    assert.equal(calls.update, 1);

    const data = (captured.updateArgs as { data: SupplierData }).data;
    assert.equal(data.name, "Starbucks Rebranded");
    assert.equal(data.floor, 5);
    assert.ok(data.openingHours.deleteMany);
    assert.equal(data.openingHours.create.length, 1);
    assert.equal(data.openingHours.create[0]!.day, "FRIDAY");
});
