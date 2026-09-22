import type { Request, Response } from "express";
import fs from "node:fs/promises";
import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import {
    buildAssetUrl,
    getContentType,
    resolveSafeUploadPath,
} from "../libs/upload.js";
import { supplierSchema } from "../schema/supplier.schema.js";
import {
    createSupplierSchema,
    parseInput,
    updateSupplierSchema,
} from "../schemas/supplier.schema.js";
import {
    createSupplier as createSupplierService,
    fetchActiveSuppliers,
    fetchAllSuppliers,
    updateSupplier as updateSupplierService,
} from "../services/supplier.service.js";

export async function viewSuppliersInPage(req: Request, res: Response) {
    const request = supplierSchema.safeParse(req.query);
    if (!request.success) {
        throw new AppError("Parameters not input correctly", 400);
    }
    const suppliers = await fetchActiveSuppliers(request.data.page);

    return res.status(200).json({
        success: true,
        data: {
            message: "All suppliers fetched successfully",
            data: suppliers,
        },
    });
}

export async function viewSuppliersForAdmin(req: Request, res: Response) {
    const request = supplierSchema.safeParse(req.query);
    if (!request.success) {
        throw new AppError("Parameters not input correctly", 400);
    }
    const suppliers = await fetchAllSuppliers(request.data.page);

    return res.status(200).json({
        success: true,
        data: {
            message: "All suppliers fetched successfully",
            data: suppliers,
        },
    });
}

export async function createSupplier(req: Request, res: Response) {
    const input = parseInput(createSupplierSchema, req.body);
    const supplier = await createSupplierService(prisma, input);

    return res.status(201).json({
        success: true,
        code: "SUCCESS",
        data: supplier,
    });
}

export async function updateSupplier(req: Request, res: Response) {
    const id = req.params.id;

    if (typeof id !== "string" || !id) {
        throw new AppError("Supplier id is required", 400, "BAD_REQUEST");
    }

    const input = parseInput(updateSupplierSchema, req.body);
    const supplier = await updateSupplierService(prisma, id, input);

    return res.status(200).json({
        success: true,
        code: "SUCCESS",
        data: supplier,
    });
}

export async function uploadSupplierImage(req: Request, res: Response) {
    if (!req.file) {
        throw new AppError("No image file provided", 400, "BAD_REQUEST");
    }

    const imageUrl = buildAssetUrl(req, req.file.filename);

    return res.status(201).json({
        success: true,
        code: "SUCCESS",
        data: { imageUrl },
    });
}

export async function serveAsset(req: Request, res: Response) {
    const filename = req.params.file as string;
    const safePath = resolveSafeUploadPath(filename);

    try {
        await fs.access(safePath);
    } catch {
        throw new AppError("Image not found", 404, "NOT_FOUND");
    }

    res.setHeader("Content-Type", getContentType(filename));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(safePath);
}
