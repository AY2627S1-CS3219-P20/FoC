import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import type { CreateSupplierInput } from "../schemas/supplier.schema.js";

mock.module("../libs/prisma.js", { namedExports: { prisma: {} } });
const { createSupplier, updateSupplier } = await import("./supplier.service.js");

type SupplierData = {
    name: string;
    type: string;
    status: string;
    latitude: number;
    floor: string;
    openingHours: {
        create: Array<{ day: string; openingTime: Date; closingTime: Date }>;
        deleteMany?: unknown;
    };
};

const MOCK_SUPPLIER = {
    id: "sup_1",
    name: "Starbucks",
    type: "FOOD",
    status: "ACTIVATED",
    building: "Engineering Building",
    floor: "1",
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
    floor: "1",
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
        findManyArgs: undefined as unknown,
        typeFindUniqueArgs: undefined as unknown,
        createArgs: undefined as unknown,
        updateArgs: undefined as unknown,
    };

    const prisma = {
        supplier: {
            findMany: mock.fn(async (args: unknown) => {
                captured.findManyArgs = args;
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
            findUnique: mock.fn(async (args: unknown) => {
                captured.typeFindUniqueArgs = args;
                calls.typeFindUnique++;
                return config.typeFindUnique ?? null;
            }),
        },
    };

    return { prisma: prisma as unknown as PrismaClient, calls, captured };
}

test("createSupplier rejects a duplicate (case-insensitive) name", async () => {
    const { prisma, calls, captured } = createMockPrisma({
        findManyReturn: [MOCK_SUPPLIER],
    });

    await assert.rejects(
        () => createSupplier(prisma, { ...validCreateInput, name: "STARBUCKS" }),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 409);
            return true;
        },
    );

    assert.equal(calls.create, 0);
    assert.deepEqual(captured.findManyArgs, {
        where: { name: { equals: "STARBUCKS", mode: "insensitive" } },
    });
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
    assert.equal(data.openingHours.create[0]!.openingTime.toISOString(), "1970-01-01T08:00:00.000Z");
    assert.equal(data.openingHours.create[0]!.closingTime.toISOString(), "1970-01-01T18:00:00.000Z");
    assert.deepEqual(captured.typeFindUniqueArgs, { where: { type: "FOOD" } });
    const { imageUrl: _imageUrl, ...expectedInput } = validCreateInput;
    assert.deepEqual(captured.createArgs, {
        data: {
            ...expectedInput,
            status: "ACTIVATED",
            openingHours: data.openingHours,
        },
        include: { openingHours: true },
    });
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
        updateReturn: { ...MOCK_SUPPLIER, name: "Starbucks Rebranded", floor: "5" },
    });

    const result = await updateSupplier(prisma, "sup_1", {
        name: "Starbucks Rebranded",
        floor: "5",
        openingHours: [{ day: "FRIDAY", openingTime: "09:00", closingTime: "17:00" }],
    });

    assert.equal(result.name, "Starbucks Rebranded");
    assert.equal(calls.update, 1);

    const data = (captured.updateArgs as { data: SupplierData }).data;
    assert.equal(data.name, "Starbucks Rebranded");
    assert.equal(data.floor, "5");
    assert.deepEqual(data.openingHours.deleteMany, {});
    assert.equal(data.openingHours.create.length, 1);
    assert.equal(data.openingHours.create[0]!.day, "FRIDAY");
    assert.deepEqual(captured.updateArgs, {
        where: { id: "sup_1" },
        data: {
            name: "Starbucks Rebranded",
            floor: "5",
            openingHours: {
                deleteMany: {},
                create: [{ day: "FRIDAY", openingTime: new Date("1970-01-01T09:00:00Z"), closingTime: new Date("1970-01-01T17:00:00Z") }],
            },
        },
        include: { openingHours: true },
    });
});

test("createSupplier defaults nullable coordinates and leaves the image default to the database", async () => {
    const { latitude, longitude, imageUrl, openingHours, ...minimal } = validCreateInput;
    const { prisma, captured } = createMockPrisma({ typeFindUnique: { type: "FOOD" } });

    await createSupplier(prisma, minimal);

    assert.deepEqual(captured.createArgs, {
        data: { ...minimal, status: "ACTIVATED", latitude: null, longitude: null, openingHours: { create: [] } },
        include: { openingHours: true },
    });
});

test("createSupplier preserves a supplied image and zero coordinates", async () => {
    const { prisma, captured } = createMockPrisma({ typeFindUnique: { type: "FOOD" } });
    await createSupplier(prisma, { ...validCreateInput, latitude: 0, longitude: 0, imageUrl: "/supplier.png" });
    const data = (captured.createArgs as { data: Record<string, unknown> }).data;
    assert.equal(data.latitude, 0);
    assert.equal(data.longitude, 0);
    assert.equal(data.imageUrl, "/supplier.png");
});

for (const action of ["create", "update"] as const) {
    test(`${action}Supplier rejects duplicate opening days without writing`, async () => {
        const { prisma, calls } = createMockPrisma({
            supplierFindUnique: MOCK_SUPPLIER,
            typeFindUnique: { type: "FOOD" },
        });
        const openingHours = [validCreateInput.openingHours![0]!, validCreateInput.openingHours![0]!];
        await assert.rejects(
            () => action === "create"
                ? createSupplier(prisma, { ...validCreateInput, openingHours })
                : updateSupplier(prisma, "sup_1", { openingHours }),
            { statusCode: 400, code: "BAD_REQUEST", message: "Duplicate opening hours for MONDAY" },
        );
        assert.equal(calls.create, 0);
        assert.equal(calls.update, 0);
    });
}

test("updateSupplier changes all supplied scalar fields without replacing hours or status", async () => {
    const { prisma, captured } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "DEACTIVATED" },
        typeFindUnique: { type: "RETAIL" },
    });
    const input = {
        name: "New name", type: "RETAIL", building: "Library", floor: "B1",
        description: "Snacks", address: "2 Library Lane", latitude: 0, longitude: 0, imageUrl: "/new.png",
    };

    await updateSupplier(prisma, "sup_1", input);

    assert.deepEqual(captured.updateArgs, {
        where: { id: "sup_1" }, data: input, include: { openingHours: true },
    });
    assert.deepEqual(captured.typeFindUniqueArgs, { where: { type: "RETAIL" } });
});

test("updateSupplier can explicitly clear optional fields and opening hours", async () => {
    const { prisma, captured } = createMockPrisma({ supplierFindUnique: MOCK_SUPPLIER });
    await updateSupplier(prisma, "sup_1", { latitude: null, longitude: null, imageUrl: null, openingHours: [] });
    assert.deepEqual(captured.updateArgs, {
        where: { id: "sup_1" },
        data: { latitude: null, longitude: null, imageUrl: null, openingHours: { deleteMany: {}, create: [] } },
        include: { openingHours: true },
    });
});

test("updateSupplier accepts a case-only rename without treating itself as a duplicate", async () => {
    const { prisma, calls, captured } = createMockPrisma({ supplierFindUnique: MOCK_SUPPLIER });
    await updateSupplier(prisma, "sup_1", { name: "STARBUCKS" });
    assert.equal(calls.findMany, 0);
    assert.equal(calls.typeFindUnique, 0);
    assert.deepEqual(captured.updateArgs, {
        where: { id: "sup_1" }, data: { name: "STARBUCKS" }, include: { openingHours: true },
    });
});

test("opening hours retain seconds at the midnight boundary", async () => {
    const { prisma, captured } = createMockPrisma({ typeFindUnique: { type: "FOOD" } });
    await createSupplier(prisma, {
        ...validCreateInput,
        openingHours: [{ day: "SUNDAY", openingTime: "00:00:01", closingTime: "23:59:59" }],
    });
    const hours = (captured.createArgs as { data: SupplierData }).data.openingHours.create[0]!;
    assert.equal(hours.openingTime.toISOString(), "1970-01-01T00:00:01.000Z");
    assert.equal(hours.closingTime.toISOString(), "1970-01-01T23:59:59.000Z");
});
