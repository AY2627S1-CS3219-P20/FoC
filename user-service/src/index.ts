import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import config from "./config/config.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser(config.cookieSecret));

// Health check endpoint
app.get("/user", (req, res) => {
    res.send("User service is running");
});

app.use("/api/auth", authRouter);

app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`User service is running at http://localhost:${PORT}`);
});