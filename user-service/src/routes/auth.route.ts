import { Router } from "express";
import {
    activateAdmin,
    login,
    logout,
    refresh,
    register,
    resendRegistrationOtp,
    verifyRegistration,
} from "../controllers/auth.controller.js";

const authRouter = Router();

authRouter.post("/admin-activation", activateAdmin);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.post("/refresh", refresh);
authRouter.post("/register", register);
authRouter.post("/register/resend", resendRegistrationOtp);
authRouter.post("/register/verify", verifyRegistration);

export default authRouter;
