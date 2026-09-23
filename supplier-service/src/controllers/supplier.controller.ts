import type { Request, Response } from "express";
import fs from "node:fs/promises";
import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import {
    buildAssetUrl,
    getContentType,
    resolveSafeUploadPath,
} from "../libs/upload.js";
import {
    typeSchema,
    supplierSchema,
    filterSearchSupplierSchema,
    createSupplierSchema,
    parseInput,
    updateSupplierSchema,
} from "../schemas/supplier.schema.js";
import {
    countForEachType,
    countActiveSuppliers,
    createType,
    deleteType,
    fetchSupplierTypes,
    createSupplier as createSupplierService,
    fetchActiveSuppliers,
    fetchAllSuppliers,
    updateSupplier as updateSupplierService,
} from "../services/supplier.service.js";

export async function countAllActiveSuppliers(req: Request, res: Response) {
    const requestBody = filterSearchSupplierSchema.safeParse(req.body);
    if (!requestBody.success) {
        throw new AppError("JSON body not input correctly", 400);
    }
    const count = await countActiveSuppliers(requestBody.data.searchString, requestBody.data.typeFilter);

    return res.status(200).json({
        success: true,
        data: {
            message: "All active suppliers counted successfully",
            data: count,
        },
    });
}

export async function viewSuppliersInPage(req: Request, res: Response) {
    const requestParams = supplierSchema.safeParse(req.query);
    if (!requestParams.success) {
        throw new AppError("Parameters not input correctly", 400);
    }

    const requestBody = filterSearchSupplierSchema.safeParse(req.body.data);
    if (!requestBody.success) {
        throw new AppError("JSON body not input correctly", 400);
    }
    const suppliers = await fetchActiveSuppliers(requestParams.data.page, requestBody.data.searchString, requestBody.data.typeFilter);

    return res.status(200).json({
        success: true,
        data: {
            message: "All suppliers fetched successfully",
            data: suppliers,
        },
    });
}

export async function getAllSupplierTypes(req: Request, res: Response) {
    const types = await fetchSupplierTypes();

    return res.status(200).json({
        success: true,
        data: {
            message: "All active suppliers counted successfully",
            data: types,
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

export async function countSupplierType(req: Request, res: Response) {
    const counts = await countForEachType();

    return res.status(200).json({
        success: true,
        data: {
            message: "Data fetched successfully",
            data: counts,
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
