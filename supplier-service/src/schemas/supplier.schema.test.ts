import test from "node:test";
import assert from "node:assert/strict";
import {
    createSupplierSchema,
    updateSupplierSchema,
    openingHoursSchema,
    parseInput,
} from "../schemas/supplier.schema.js";
import { AppError } from "../errors/errors.js";

const validCreateInput = {
    name: "Starbucks",
    type: "FOOD",
    building: "Engineering Building",
    floor: 1,
    description: "Coffee and pastries",
    address: "4 Engineering Road",
    latitude: 1.30,
    longitude: 103.77,
    imageUrl: "https://example.com/starbucks.jpg",
    openingHours: [
        { day: "MONDAY", openingTime: "08:00", closingTime: "18:00" },
        { day: "TUESDAY", openingTime: "08:00", closingTime: "18:00" },
    ],
};

test("createSupplierSchema accepts a complete valid payload", () => {
    const result = createSupplierSchema.parse(validCreateInput);

    assert.equal(result.name, "Starbucks");
    assert.equal(result.openingHours?.length, 2);
});

test("createSupplierSchema trims and accepts optional fields omitted", () => {
    const minimal = {
        name: "Vending Machine",
        type: "RETAIL",
        building: "Library",
        floor: 2,
        description: "Snacks",
        address: "2 Library Lane",
    };

    const result = createSupplierSchema.parse(minimal);

    assert.equal(result.latitude, undefined);
    assert.equal(result.longitude, undefined);
    assert.equal(result.imageUrl, undefined);
    assert.equal(result.openingHours, undefined);
});

test("createSupplierSchema rejects missing required fields", () => {
    assert.throws(
        () => createSupplierSchema.parse({ ...validCreateInput, name: "" }),
        (error: unknown) => error instanceof Error && error.name === "ZodError",
    );
});

test("createSupplierSchema rejects a negative non-integer floor", () => {
    assert.throws(
        () => createSupplierSchema.parse({ ...validCreateInput, floor: -1 }),
        (error: unknown) => error instanceof Error && error.name === "ZodError",
    );
});

test("createSupplierSchema rejects an invalid day of week", () => {
    assert.throws(
        () =>
            createSupplierSchema.parse({
                ...validCreateInput,
                openingHours: [{ day: "SUNDAYY", openingTime: "08:00", closingTime: "18:00" }],
            }),
        (error: unknown) => error instanceof Error && error.name === "ZodError",
    );
});

test("createSupplierSchema rejects malformed times", () => {
    assert.throws(
        () =>
            createSupplierSchema.parse({
                ...validCreateInput,
                openingHours: [{ day: "MONDAY", openingTime: "8am", closingTime: "6pm" }],
            }),
        (error: unknown) => error instanceof Error && error.name === "ZodError",
    );
});

test("updateSupplierSchema accepts a partial payload", () => {
    const result = updateSupplierSchema.parse({ name: "Starbucks #2", floor: 3 });

    assert.equal(result.name, "Starbucks #2");
    assert.equal(result.type, undefined);
});

test("openingHoursSchema accepts a valid single row", () => {
    const result = openingHoursSchema.parse({
        day: "WEDNESDAY",
        openingTime: "09:00",
        closingTime: "17:30",
    });

    assert.equal(result.day, "WEDNESDAY");
});

test("parseInput returns the parsed value for valid input", () => {
    const result = parseInput(createSupplierSchema, validCreateInput);

    assert.equal(result.name, "Starbucks");
});

test("parseInput throws AppError(422) for invalid input", () => {
    assert.throws(
        () => parseInput(createSupplierSchema, { name: "" }),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 422);
            assert.equal(error.code, "UNPROCESSABLE_ENTITY");
            return true;
        },
    );
});
