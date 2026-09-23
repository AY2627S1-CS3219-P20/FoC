import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { Role } from "../types/auth.types.js";
import { createSupplierType, deleteSupplierType, viewSuppliersInPage } from "../controllers/supplier.controller.js";

const supplierRouter = Router();

// All supplier endpoints require authentication (require users to have been logged in)
supplierRouter.use(authenticate);

// For admin endpoints, use the authorize middleware to check if the user has the required role
// supplierRouter.get("/all", authorize(Role.ADMIN), viewSuppliersInPage);

// View all the suppliers that can be listed in the current page
supplierRouter.get("/", viewSuppliersInPage);

// both routes below expect a json body and require admin persmissions to access
supplierRouter.post("/new-supplier-type", authorize(Role.ADMIN), createSupplierType) // create a new supplier type that does not currently exist
supplierRouter.post("/delete-supplier-type", authorize(Role.ADMIN), deleteSupplierType) // delete a new supplier type that does not currently exist

export default supplierRouter;