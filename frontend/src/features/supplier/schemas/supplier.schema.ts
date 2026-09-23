import { z } from "zod";

export const SUPPLIER_TYPES = ["FOOD", "RETAIL", "FACILITIES"] as const;

export type SupplierType = typeof SUPPLIER_TYPES[number];

export const supplierDayValues = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
] as const;

export const supplierFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z
        .string()
        .min(1, "Please select a supplier type")
        .refine(value => (SUPPLIER_TYPES as readonly string[]).includes(value), {
            message: "Please select a supplier type",
        }),
    description: z.string().min(1, "Description is required"),
    address: z.string().min(1, "Address is required"),
    building: z.string(),
    floor: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    imageUrl: z.string(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export const supplierDayLabels: Record<typeof supplierDayValues[number], string> = {
    MONDAY: "Monday",
    TUESDAY: "Tuesday",
    WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday",
    FRIDAY: "Friday",
    SATURDAY: "Saturday",
    SUNDAY: "Sunday",
};
