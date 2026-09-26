import { Router } from "express";
import {
  changePassword,
  getMyProfile,
  listUsers,
  resendEmailChangeOtp,
  startEmailChange,
  updateMyProfile,
  verifyEmailChange,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeAdmin } from "../middlewares/authorize.middleware.js";

const userRouter = Router();

userRouter.use(authenticate);
userRouter.get("/me", getMyProfile);
userRouter.patch("/me", updateMyProfile);
userRouter.post("/me/email-change", startEmailChange);
userRouter.post("/me/email-change/resend", resendEmailChangeOtp);
userRouter.post("/me/email-change/verify", verifyEmailChange);
userRouter.post("/me/password-change", changePassword);

userRouter.use(authorizeAdmin);
userRouter.get("/", listUsers);

export default userRouter;
