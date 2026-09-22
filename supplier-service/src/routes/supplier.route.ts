import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
    viewAllAvailableSuppliers,
    createSupplier,
    updateSupplier,
} from "../controllers/supplier.controller.js";

const supplierRouter = Router();

// All supplier endpoints require authentication
supplierRouter.use(authenticate);

// View all available suppliers (F1)
supplierRouter.get("/", viewAllAvailableSuppliers);

// Admin supplier management
supplierRouter.post("/", requireAdmin, createSupplier);
supplierRouter.patch("/:id", requireAdmin, updateSupplier);

export default supplierRouter;
