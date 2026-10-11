import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import config from "./config/config.js";
import { AppError } from "./errors/errors.js";
import { prisma } from "./libs/prisma.js";
import { bootstrapAdmin } from "./services/bootstrap-admin.service.js";

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser(config.cookieSecret));

// Health check endpoint
app.get("/user", (_req: Request, res: Response) => {
    res.send("User service is running");
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);

// Catch all * not found routes
app.use((_req: Request, _res: Response) => {
    throw new AppError("Not found", 404);
});

app.use(errorHandler);

const PORT = config.port;

try {
    const result = await bootstrapAdmin(prisma);
    console.info(`Admin bootstrap: ${result}`);
    app.listen(PORT, () => {
        console.log(`User service is running at http://localhost:${PORT}`);
    });
} catch (error) {
    console.error(error instanceof Error ? error.message : "Admin bootstrap failed");
    await prisma.$disconnect();
    process.exitCode = 1;
}
