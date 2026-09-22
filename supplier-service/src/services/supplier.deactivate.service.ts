import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import { STATUS } from "./supplier.service.js";

export async function deactivateSupplier(
    prisma: PrismaClient,
    id: string,
): Promise<Prisma.SupplierModel> {
    const supplier = await prisma.supplier.findUnique({ where: { id } });

    if (!supplier) {
        throw new AppError("Supplier not found", 404, "NOT_FOUND");
    }

    if (supplier.status === STATUS.DEACTIVATED) {
        throw new AppError(
            "Supplier is already deactivated",
            409,
            "CONFLICT",
        );
    }

    return prisma.supplier.update({
        where: { id },
        data: { status: STATUS.DEACTIVATED },
        include: { openingHours: true },
    });
}
