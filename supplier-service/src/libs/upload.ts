import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import multer from "multer";

import { AppError } from "../errors/errors.js";
import config from "../config/config.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIMETYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const defaultAssetsDir = (): string => {
    const configured = process.env.ASSETS_DIR;
    if (configured) {
        return path.resolve(configured);
    }
    return path.resolve(moduleDir, "../../uploads");
};

export const UPLOADS_DIR = defaultAssetsDir();

export const ensureUploadsDir = async (): Promise<void> => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
};

const uniqueFilename = (originalname: string): string => {
    const ext = path.extname(originalname).toLowerCase();
    return `${randomUUID()}${ext}`;
};

export const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
            cb(null, uniqueFilename(file.originalname));
        },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.has(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new AppError("Only image files are allowed", 400, "BAD_REQUEST"));
    },
});

export const buildAssetUrl = (req: Request, filename: string): string => {
    const base = config.assetsPublicUrl;
    const origin = base
        ? base.replace(/\/$/, "")
        : `${req.protocol}://${req.headers.host}`;
    return `${origin}/api/supplier/assets/${filename}`;
};

export const getContentType = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
};

export const resolveSafeUploadPath = (filename: string): string => {
    const clean = path.basename(filename);
    if (clean === "." || clean === "..") {
        throw new AppError("Invalid asset name", 400, "BAD_REQUEST");
    }
    const uploadsDir = path.resolve(UPLOADS_DIR);
    const resolved = path.resolve(uploadsDir, clean);
    if (resolved !== uploadsDir && !resolved.startsWith(uploadsDir + path.sep)) {
        throw new AppError("Invalid asset name", 400, "BAD_REQUEST");
    }
    return resolved;
};

export { MAX_FILE_SIZE };
