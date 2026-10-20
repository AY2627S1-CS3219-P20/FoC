import { Router, type ErrorRequestHandler } from "express";
import { abortReservationController, createReservationController, getReservationController, renewReservationController } from "../controllers/internal-credit.controller.js";
import { AppError } from "../errors/errors.js";
import { authenticateOrderCreditService } from "../middleware/order-credit-service-auth.middleware.js";

const internalCreditRouter = Router();

// Authenticate requests from the order-credit-service using a shared secret token
internalCreditRouter.use(authenticateOrderCreditService);

// Error handler for invalid JSON body
const parseJsonError: ErrorRequestHandler = (error, _req, _res, next) => {
    next(
        error?.type === "entity.parse.failed"
            ? new AppError("Invalid JSON body", 400)
            : error,
    );
};
internalCreditRouter.use(parseJsonError);

internalCreditRouter.post("/reservations", createReservationController);
internalCreditRouter.get("/reservations/:reservationId", getReservationController);
internalCreditRouter.post("/reservations/:reservationId/abort", abortReservationController);
internalCreditRouter.post("/reservations/renew", renewReservationController);

export default internalCreditRouter;