import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { Role } from "../types/auth.types.js";
import {
    createSupplierType,
    deleteSupplierType,
    viewSuppliersInPage,
    viewSuppliersForAdmin,
    createSupplier,
    updateSupplier,
    uploadSupplierImage,
    serveAsset,
    countAllActiveSuppliers,
    getAllSupplierTypes,
} from "../controllers/supplier.controller.js";
import { upload } from "../libs/upload.js";
import { deactivateSupplier as deactivateSupplierRoute } from "../controllers/supplier.deactivate.controller.js";

const supplierRouter = Router();

// Public: serve an uploaded image by filename
supplierRouter.get("/assets/:file", serveAsset);

// All supplier endpoints require authentication
supplierRouter.use(authenticate);

// View the suppliers listed on the current page (active suppliers only)
supplierRouter.post("/", viewSuppliersInPage);

// count the total number of active suppliers that match the search key and type filter
supplierRouter.post("/count-active-suppliers", countAllActiveSuppliers);

// get all supplier types, don't require admin access 
supplierRouter.get("/get-supplier-types", getAllSupplierTypes);

// both routes below expect a json body and require admin persmissions to access
supplierRouter.post("/new-supplier-type", authorize(Role.ADMIN), createSupplierType) // create a new supplier type that does not currently exist
supplierRouter.post("/delete-supplier-type", authorize(Role.ADMIN), deleteSupplierType) // delete a new supplier type that does not currently exist

// Admin: list all suppliers including deactivated (management page)
supplierRouter.get("/all", authorize(Role.ADMIN), viewSuppliersForAdmin);

// Admin: upload a supplier location image
supplierRouter.post("/upload-image", authorize(Role.ADMIN), upload.single("image"), uploadSupplierImage);

// Admin supplier management
supplierRouter.post("/", authorize(Role.ADMIN), createSupplier);
supplierRouter.patch("/:id", authorize(Role.ADMIN), updateSupplier);
supplierRouter.patch("/:id/deactivate", authorize(Role.ADMIN), deactivateSupplierRoute);

export default supplierRouter;
