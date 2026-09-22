import type { Request, Response } from "express";
import { fetchSuppliers } from "../services/supplier.service.js";
import { supplierSchema } from "../schema/supplier.schema.js";
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