import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import config from "./config/config.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { AppError } from "./errors/errors.js";
import orderRouter from "./routes/order.route.js";

const app = express();

app.use(
    cors({
        origin: config.frontendUrl,
        credentials: true,
    }),
);

app.use(express.json());

// Health check endpoint
app.get("/orders", (_req: Request, res: Response) => {
    res.send("Orders service is running");
});

app.use("/api/orders", orderRouter);

// Catch all * not found routes
app.use((_req: Request, _res: Response) => {
    throw new AppError("Not found", 404);
});

app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`Order service is running at http://localhost:${PORT}`);
});