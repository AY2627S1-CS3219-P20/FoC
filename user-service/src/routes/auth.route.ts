import { Router } from "express";
import {
    login,
    logout,
    refresh,
    register,
    resendRegistrationOtp,
} from "../controllers/auth.controller.js";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.post("/refresh", refresh);
authRouter.post("/register", register);
authRouter.post("/register/resend", resendRegistrationOtp);

export default authRouter;
