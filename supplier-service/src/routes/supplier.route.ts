import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { Role } from "../types/auth.types.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
    createSupplierType,
    deleteSupplierType,
    viewSuppliersInPage,
    viewSuppliersForAdmin,
    createSupplier,
    updateSupplier,
    uploadSupplierImage,
    serveAsset,
} from "../controllers/supplier.controller.js";
import { upload } from "../libs/upload.js";
import { deactivateSupplier as deactivateSupplierRoute } from "../controllers/supplier.deactivate.controller.js";

const supplierRouter = Router();

// Public: serve an uploaded image by filename
supplierRouter.get("/assets/:file", serveAsset);

// All supplier endpoints require authentication
supplierRouter.use(authenticate);

// View the suppliers listed on the current page (active suppliers only)
supplierRouter.get("/", viewSuppliersInPage);

// both routes below expect a json body and require admin persmissions to access
supplierRouter.post("/new-supplier-type", authorize(Role.ADMIN), createSupplierType) // create a new supplier type that does not currently exist
supplierRouter.post("/delete-supplier-type", authorize(Role.ADMIN), deleteSupplierType) // delete a new supplier type that does not currently exist

// Admin: list all suppliers including deactivated (management page)
supplierRouter.get("/all", requireAdmin, viewSuppliersForAdmin);

// Admin: upload a supplier location image
supplierRouter.post("/upload-image", requireAdmin, upload.single("image"), uploadSupplierImage);

// Admin supplier management
supplierRouter.post("/", requireAdmin, createSupplier);
supplierRouter.patch("/:id", requireAdmin, updateSupplier);
supplierRouter.patch("/:id/deactivate", requireAdmin, deactivateSupplierRoute);

export default supplierRouter;
