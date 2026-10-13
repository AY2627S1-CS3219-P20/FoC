import { AppError } from "../errors/errors.js";
import { OrderStatus } from "../generated/prisma/client.js";
import { verifySupplierExists } from "../integrations/supplier/supplier.client.js";
import { prisma } from "../libs/prisma.js";
import type { RequesterOrderHistoryQuery, UpdateRequestInput } from "../schemas/order.requester.schema.js";

export async function getRequesterOrderHistoryService(
    requesterId: string,
    query: RequesterOrderHistoryQuery
) {
    const { page, limit, status, sortBy, sortOrder } = query;
    const where = {
        requesterId: requesterId,
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

export async function updateRequestService(
    requesterId: string,
    orderId: string,
    input: UpdateRequestInput,
    accessToken: string
) {
    const { expectedVersion, ...changes } = input;

    const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
    });

    if (!existingOrder || existingOrder.requesterId !== requesterId) {
        throw new AppError("Order not found", 404);
    }

    if (existingOrder.status !== OrderStatus.OPEN ||
        existingOrder.courierId !== null) {
        throw new AppError("This order can no longer be edited", 400);
    }

    if (changes.expiryAt && changes.expiryAt <= new Date()) {
        throw new AppError("Expiry date and time must be in the future", 400);
    }

    if (changes.pickupSupplierId) {
        const pickupSupplierExists = await verifySupplierExists(
            changes.pickupSupplierId,
            accessToken
        );

        if (!pickupSupplierExists) {
            throw new AppError("Pickup supplier does not exist", 400);
        }
    }

    if (changes.deliverySupplierId) {
        const deliverySupplierExists = await verifySupplierExists(
            changes.deliverySupplierId,
            accessToken
        );
        if (!deliverySupplierExists) {
            throw new AppError("Delivery supplier does not exist", 400);
        }
    }

    // Prepare the data to update, only including fields that are provided in the input
    const dataToUpdate = {
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.description !== undefined && { description: changes.description }),
        ...(changes.pickupSupplierId !== undefined && { pickupSupplierId: changes.pickupSupplierId }),
        ...(changes.deliverySupplierId !== undefined && { deliverySupplierId: changes.deliverySupplierId }),
        ...(changes.remarks !== undefined && { remarks: changes.remarks }),
        ...(changes.expiryAt !== undefined && { expiryAt: changes.expiryAt }),
    };

    return await prisma.$transaction(async (tx) => {
        // This ensure that there is no race condition when updating the order,
        // e.g. A courier accepts the order while the requester is updating it.
        const updatedOrder = await tx.order.updateMany({
            where: {
                id: orderId,
                requesterId: requesterId,
                status: OrderStatus.OPEN,
                courierId: null,
                version: expectedVersion, // Ensure the version matches the expected version for optimistic concurrency control
            },
            data: {
                ...dataToUpdate,
                version: { increment: 1 }, // Increment the version 
            },
        });

        if (updatedOrder.count === 0) {
            throw new AppError("The request changed while you were editing it. Reload and try again.", 409);
        }

        // Return the updated order
        return tx.order.findFirstOrThrow({
            where: { id: orderId },
        });
    });
};