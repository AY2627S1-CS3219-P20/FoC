import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { viewSuppliersInPage } from "../controllers/supplier.controller.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { Role } from "../types/auth.types.js";

const supplierRouter = Router();

// All supplier endpoints require authentication (require users to have been logged in)
supplierRouter.use(authenticate);

// For admin endpoints, use the authorize middleware to check if the user has the required role
// supplierRouter.get("/all", authorize(Role.ADMIN), viewSuppliersInPage);

// View all the suppliers that can be listed in the current page
supplierRouter.get("/", viewSuppliersInPage);

export default supplierRouter;