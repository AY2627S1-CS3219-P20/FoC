import { z } from "zod";
import {
  phoneNumberSchema,
  usernameSchema,
} from "./register.schema.js";

export const updateMyProfileSchema = z
  .strictObject({
    username: usernameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
  })
  .refine(
    (value) => value.username !== undefined || value.phoneNumber !== undefined,
    { message: "Provide a username or phone number to update" },
  );

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
