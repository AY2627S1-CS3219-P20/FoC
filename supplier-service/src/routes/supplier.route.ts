import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { Role } from "../types/auth.types.js";
import { upload } from "../libs/upload.js";
import { uploadSupplierImage, serveAsset } from "../controllers/supplier.asset.controller.js"
import { countSuppliersForType, createSupplierType, deleteSupplierType, getAllSupplierTypes } from "../controllers/supplier.type.controller.js";
import {
    createSupplier,
    updateSupplier,
    getSuppliers,
    getActiveSuppliers,
    getSupplierById,
    getSuppliersByIds,
    deactivateSupplier
} from "../controllers/supplier.controller.js";


const supplierRouter = Router();

// All supplier endpoints require authentication
supplierRouter.use(authenticate);


// ------------------------ Suppliers -------------------------
// Query the ALL suppliers listed based on the current page number, search key and filters
supplierRouter.get("", authorize(Role.ADMIN), getSuppliers);

// Query the ACTIVE suppliers listed based on the current page number, search key and filters
supplierRouter.get("/active", getActiveSuppliers);

// Query the suppliers by providing a list of supplier ids we want to retrieve (name, id, type) information for
supplierRouter.get("/by-ids", getSuppliersByIds);

// Get one supplier's (full) information by providing its supplier id
supplierRouter.get("/:supplierId", getSupplierById);

// Create a new supplier (by admin)
supplierRouter.post("", authorize(Role.ADMIN), createSupplier);

// Update an existing supplier (by admin)
supplierRouter.patch("/:supplierId", authorize(Role.ADMIN), updateSupplier);

// Deactivate an existing supplier (by admin)
supplierRouter.patch("/:supplierId/deactivation", authorize(Role.ADMIN), deactivateSupplier);

// Activate an existing supplier (by admin)
// supplierRouter.patch("/:supplierId/activation", authorize(Role.ADMIN), activateSupplier);


// --------------------- Supplier Types -----------------------
// Query supplier types
supplierRouter.get("/types", getAllSupplierTypes);

// Count the number of suppliers with a specified typeId
supplierRouter.get("/:typeId/suppliers/count", countSuppliersForType);

// Create new supplier type
supplierRouter.post("/types", createSupplierType);

// Delete existing supplier type
supplierRouter.delete("/types/:typeId", deleteSupplierType);


// ------------------------- Assets --------------------------
// Get a supplier image based on its file name
supplierRouter.get("/assets/images/:filename", serveAsset);

// Upload a new supplier image (by admin)
supplierRouter.post("/assets/images", authorize(Role.ADMIN), upload.single("image"), uploadSupplierImage);


export default supplierRouter;
