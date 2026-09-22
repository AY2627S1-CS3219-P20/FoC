import type { Request, Response } from "express";
import { createType, deleteType, fetchSuppliers } from "../services/supplier.service.js";
import { typeSchema, supplierSchema } from "../schema/supplier.schema.js";
import { AppError } from "../errors/errors.js";

export async function viewSuppliersInPage(req: Request, res: Response) {
    // console.log("Fetching all suppliers...");

    const request = supplierSchema.safeParse(req.query);
    if (!request.success) {
        // we need to make sure this block is not reached, i.e. the request body has a "page" field
        request.error; // ZodError instance
        throw new AppError("Parameters not input correctly", 400);
    }
    const suppliers = await fetchSuppliers(request.data.page);

    return res.status(200).json({
        success: true,
        data: {
            message: "All suppliers fetched successfully",
            data: suppliers,
        },
    });
}

export async function createSupplierType(req: Request, res: Response) {
    const request = typeSchema.safeParse(req.body);
    if (!request.success) {
        // we need to make sure this block is not reached, i.e. the request body has a "type" field
        request.error; // ZodError instance
        throw new AppError("Parameters not input correctly", 400);
    }
    const newType = await createType(request.data.type);

    return res.status(200).json({
        success: true,
        data: {
            message: "New supplier type created successfully",
            data: newType,
        },
    });
}

export async function deleteSupplierType(req: Request, res: Response) {
    const request = typeSchema.safeParse(req.body);
    if (!request.success) {
        // we need to make sure this block is not reached, i.e. the request body has a "type" field
        request.error; // ZodError instance
        console.log(request.error)
        throw new AppError("Parameters not input correctly", 400);
    }
    const deletedType = await deleteType(request.data.type);

    return res.status(200).json({
        success: true,
        data: {
            message: "Existing supplier type deleted successfully",
            data: deletedType,
        },
    });
}