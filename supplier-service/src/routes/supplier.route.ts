import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { viewAllAvailableSuppliers } from "../controllers/supplier.controller.js";

const supplierRouter = Router();

// All supplier endpoints require authentication
supplierRouter.use(authenticate);

// View all available suppliers
supplierRouter.get("/", viewAllAvailableSuppliers);

export default supplierRouter;