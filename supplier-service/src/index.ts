import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import supplierRouter from "./routes/supplier.route.js";
import config from "./config/config.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { ensureUploadsDir } from "./libs/upload.js";
import { AppError } from "./errors/errors.js";

const app = express();

await ensureUploadsDir();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    }),
);

app.use(express.json());

// Health check endpoint
app.get("/supplier", (_req: Request, res: Response) => {
    res.send("Suppliers service is running");
});

app.use("/api/supplier", supplierRouter);

// Catch all * not found routes
app.use((_req: Request, _res: Response) => {
    throw new AppError("Not found", 404);
});

app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`Supplier service is running at http://localhost:${PORT}`);
});