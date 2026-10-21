import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import config from "./config/config.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { AppError } from "./errors/errors.js";
import creditRouter from "./routes/credit.route.js";
import { prisma } from "./libs/prisma.js";
import { startRegistrationConsumer } from "./services/registration-consumer.service.js";
import internalCreditRouter from "./routes/internal-credit.route.js";
import { startSettlementConsumer } from "./services/settlement-consumer.service.js";

const app = express();

app.use(
    cors({
        origin: config.frontendUrl,
        credentials: true,
    }),
);

app.use(express.json());

app.use("/api/internal/credits", internalCreditRouter);

// Health check endpoint
app.get("/healthz", (_req: Request, res: Response) => {
    res.send("Credits service is running");
});

app.use("/api/credits", creditRouter);

// Catch all * not found routes
app.use((_req: Request, _res: Response) => {
    throw new AppError("Not found", 404);
});

app.use(errorHandler);

const PORT = config.port;

let stopConsumer: (() => Promise<void>) | undefined;
let stopSettlement: (() => Promise<void>) | undefined;
let shuttingDown = false;
const server = app.listen(PORT, () => {
    console.log(`Credit service is running at http://localhost:${PORT}`);
    if (!shuttingDown) {
        stopConsumer = startRegistrationConsumer(prisma);
        stopSettlement = startSettlementConsumer(prisma);
    }
});

const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 15_000);
    deadline.unref();
    try {
        await Promise.all([
            stopConsumer?.(),
            stopSettlement?.(),
            new Promise<void>((resolve, reject) => {
                server.close(error => error ? reject(error) : resolve());
            }),
        ]);
        await prisma.$disconnect();
        clearTimeout(deadline);
    } catch {
        console.error("Credit service shutdown failed");
        process.exitCode = 1;
    }
};
process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
