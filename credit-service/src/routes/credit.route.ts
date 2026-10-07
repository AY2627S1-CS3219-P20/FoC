import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";

const creditRouter = Router();

// All order endpoints require authentication
creditRouter.use(authenticate);

export default creditRouter;