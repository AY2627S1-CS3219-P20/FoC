import { prisma } from "../libs/prisma.js";
import type { RequesterOrderHistoryQuery } from "../schemas/order.requester.schema.js";

export async function getRequesterOrderHistoryService(
    requesterId: string,
    query: RequesterOrderHistoryQuery
) {
    const { page, limit, status, sortBy, sortOrder } = query;
    const where = {
        requesterId,
        ...(status ? { status: status } : {}), // If status is provided, include it in the where clause; otherwise, don't filter by status
    };

    const [orders, totalCount] = await Promise.all([
        prisma.order.findMany({
            where,
            orderBy: {
                [sortBy]: sortOrder,
            },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.order.count({ where }),
    ]);

    return {
        orders,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
        },
    };
};