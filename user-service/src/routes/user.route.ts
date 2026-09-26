import { Router } from "express";
import {
  changePassword,
  getMyProfile,
  resendEmailChangeOtp,
  startEmailChange,
  updateMyProfile,
  verifyEmailChange,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.use(authenticate);
userRouter.get("/me", getMyProfile);
userRouter.patch("/me", updateMyProfile);
userRouter.post("/me/email-change", startEmailChange);
userRouter.post("/me/email-change/resend", resendEmailChangeOtp);
userRouter.post("/me/email-change/verify", verifyEmailChange);
userRouter.post("/me/password-change", changePassword);

export default userRouter;
