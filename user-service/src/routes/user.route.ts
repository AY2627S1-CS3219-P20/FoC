import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.use(authenticate);
userRouter.get("/me", getMyProfile);
userRouter.patch("/me", updateMyProfile);

export default userRouter;
