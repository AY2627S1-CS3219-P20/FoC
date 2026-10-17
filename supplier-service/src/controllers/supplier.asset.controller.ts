import type { Request, Response } from "express";
import fs from "node:fs/promises";
import { AppError } from "../errors/errors.js";
import {
    buildAssetUrl,
    getContentType,
    resolveSafeUploadPath,
} from "../libs/upload.js";

// get file using filename
export async function serveAsset(req: Request, res: Response) {
    const filename = req.params.filename as string;
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

// add new supplier image
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
