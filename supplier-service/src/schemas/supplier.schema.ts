import { z, ZodError } from "zod";
import { Day } from "../generated/prisma/enums.js";
import { AppError } from "../errors/errors.js";

const dayValues = Object.values(Day) as [string, ...string[]];

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export const openingHoursSchema = z.object({
    day: z.enum(dayValues, { error: "Invalid day of week" }),
    openingTime: z.string().regex(timePattern, {
        error: "Opening time must be in HH:MM (24-hour) format",
    }),
    closingTime: z.string().regex(timePattern, {
        error: "Closing time must be in HH:MM (24-hour) format",
    }),
});

export const createSupplierSchema = z.object({
    name: z.string().trim().min(1, { error: "Name is required" }),
    type: z.string().trim().min(1, { error: "Type is required" }),
    building: z.string().trim().nullable().optional(),
    floor: z.number().int().nonnegative().nullable().optional(),
    description: z.string().min(1, { error: "Description is required" }),
    address: z.string().min(1, { error: "Address is required" }),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    imageUrl: z.string().min(1, { error: "Image URL must not be empty" }).nullable().optional(),
    openingHours: z.array(openingHoursSchema).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type OpeningHoursInput = z.infer<typeof openingHoursSchema>;

export function parseInput<T>(schema: z.ZodSchema<T>, body: unknown): T {
    try {
        return schema.parse(body);
    } catch (error) {
        const issue = error instanceof ZodError ? error.issues[0] : undefined;
        throw new AppError(
            issue?.message ?? "Invalid request body",
            422,
            "UNPROCESSABLE_ENTITY",
        );
    }
}
