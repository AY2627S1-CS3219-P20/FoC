import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import type { PrismaClient } from "../generated/prisma/client.js";
import { deactivateSupplier } from "./supplier.deactivate.service.js";
import { AppError } from "../errors/errors.js";

type SupplierData = {
    status: string;
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

interface MockConfig {
    supplierFindUnique?: unknown | null;
    updateReturn?: unknown;
}

function createMockPrisma(config: MockConfig = {}) {
    const calls = {
        findUnique: 0,
        update: 0,
    };

    const captured = {
        updateArgs: undefined as unknown,
    };

    const prisma = {
        supplier: {
            findUnique: mock.fn(async () => {
                calls.findUnique++;
                return config.supplierFindUnique ?? null;
            }),
            update: mock.fn(async (args: unknown) => {
                calls.update++;
                captured.updateArgs = args;
                return config.updateReturn ?? config.supplierFindUnique ?? {};
            }),
        },
    };

    return { prisma: prisma as unknown as PrismaClient, calls, captured };
}

test("deactivateSupplier returns 404 for an unknown supplier", async () => {
    const { prisma, calls } = createMockPrisma({ supplierFindUnique: null });

    await assert.rejects(
        () => deactivateSupplier(prisma, "missing"),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 404);
            return true;
        },
    );

    assert.equal(calls.update, 0);
});

test("deactivateSupplier rejects when already deactivated", async () => {
    const { prisma, calls } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "DEACTIVATED" },
    });

    await assert.rejects(
        () => deactivateSupplier(prisma, "sup_1"),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 409);
            return true;
        },
    );

    assert.equal(calls.update, 0);
});

test("deactivateSupplier sets the supplier status to DEACTIVATED", async () => {
    const { prisma, calls, captured } = createMockPrisma({
        supplierFindUnique: { ...MOCK_SUPPLIER, status: "ACTIVATED" },
        updateReturn: { ...MOCK_SUPPLIER, status: "DEACTIVATED" },
    });

    const result = await deactivateSupplier(prisma, "sup_1");

    assert.equal(result.status, "DEACTIVATED");
    assert.equal(calls.update, 1);

    const data = (captured.updateArgs as { data: SupplierData }).data;
    assert.equal(data.status, "DEACTIVATED");
});
