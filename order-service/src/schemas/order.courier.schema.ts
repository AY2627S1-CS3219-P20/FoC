import { z } from "zod";
import { OrderStatus } from "../generated/prisma/client.js";

const orderStatuses = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];

export const getOpenOrdersSchema = z.object({
    page: z.coerce.number().int().positive(),
    sortBy: z.enum(["offeredCredits", "expiryAt"]).default("expiryAt"),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    // filterBy: z.enum(["pickup", "delivery"]).optional(),
    // filterLocations: z.string().array().optional(),
    searchString: z.string().optional()
});

export const getCourierOrderHistorySchema = z.object({
    page: z.coerce.number().int().positive(),
    sortOrder: z.enum(['asc', 'desc']).default('asc') // only can sort by expiryAt
});

export type GetOpenOrdersInput = z.infer<typeof getOpenOrdersSchema>;
export type GetCourierOrderHistoryInput = z.infer<typeof getCourierOrderHistorySchema>;
