import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import config from "./config/config.js";
import { AppError } from "./errors/errors.js";

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser(config.cookieSecret));

// Health check endpoint
app.get("/user", (_req: Request, res: Response) => {
    res.send("User service is running");
});

app.use("/api/auth", authRouter);

// Catch all * not found routes
app.use((_req: Request, _res: Response) => {
    throw new AppError("Not found", 404);
});

app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`User service is running at http://localhost:${PORT}`);
});