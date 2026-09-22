import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
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

// View the suppliers listed on the current page
supplierRouter.get("/", viewSuppliersInPage);

// Admin: list all suppliers including deactivated (management page)
supplierRouter.get("/all", requireAdmin, viewSuppliersForAdmin);

// Admin: upload a supplier location image
supplierRouter.post("/upload-image", requireAdmin, upload.single("image"), uploadSupplierImage);

// Admin supplier management
supplierRouter.post("/", requireAdmin, createSupplier);
supplierRouter.patch("/:id", requireAdmin, updateSupplier);
supplierRouter.patch("/:id/deactivate", requireAdmin, deactivateSupplierRoute);

export default supplierRouter;
