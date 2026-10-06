import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";

const orderRouter = Router();

// All order endpoints require authentication
orderRouter.use(authenticate);

// ----------- Orders -----------
// Create a new order
// orderRouter.post("/");

// Get all orders with OPEN status
// orderRouter.get("/");

// Orders created by the authenticated requester
// orderRouter.get("/mine/requester");

// Orders accepted by the authenticated courier
// orderRouter.get("/mine/courier");

// Update a specific order by ID
// orderRouter.patch("/:orderId");

// Get a specific order by ID
// orderRouter.get("/:orderId");

// ----------- Order lifecycle -----------
// Cancel an order (by requester)
// orderRouter.post("/:orderId/cancellation");

// Mark an order as received (by requester)
// orderRouter.post("/:orderId/receipt");

// Mark an order as failed (by requester)
// orderRouter.post("/:orderId/failure");

// Mark an order as renewed (by requester)
// orderRouter.post("/:orderId/renewal");

// Accept an order (by courier)
// orderRouter.post("/:orderId/acceptance");

// Drop acceptance (by courier)
// orderRouter.delete("/:orderId/acceptance");

// Mark an order as picked up (by courier)
// orderRouter.post("/:orderId/pickup");

// Mark an order as completed (by courier)
// orderRouter.post("/:orderId/completion");

export default orderRouter;