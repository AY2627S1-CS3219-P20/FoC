import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import config from "./config/config.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { AppError } from "./errors/errors.js";
import creditRouter from "./routes/credit.route.js";

const app = express();

app.use(
    cors({
        origin: config.frontendUrl,
        credentials: true,
    }),
);

app.use(express.json());

// Health check endpoint
app.get("/credits", (_req: Request, res: Response) => {
    res.send("Credits service is running");
});

app.use("/api/credits", creditRouter);

// Catch all * not found routes
app.use((_req: Request, _res: Response) => {
    throw new AppError("Not found", 404);
});

app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`Credit service is running at http://localhost:${PORT}`);
});