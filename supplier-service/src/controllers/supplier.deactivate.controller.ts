import type { Request, Response } from "express";
import { prisma } from "../libs/prisma.js";
import { deactivateSupplier as deactivateSupplierService } from "../services/supplier.deactivate.service.js";
import { AppError } from "../errors/errors.js";

export async function deactivateSupplier(req: Request, res: Response) {
    const id = req.params.id;

    if (typeof id !== "string" || !id) {
        throw new AppError("Supplier id is required", 400, "BAD_REQUEST");
    }

    const supplier = await deactivateSupplierService(prisma, id);

    return res.status(200).json({
        success: true,
        code: "SUCCESS",
        data: supplier,
    });
}
