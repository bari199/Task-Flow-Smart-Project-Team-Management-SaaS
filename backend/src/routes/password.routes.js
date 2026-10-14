import { Router } from "express";
import rateLimit from "express-rate-limit";

import { validate } from "../middlewares/validate.middleware.js";

import {
  forgotPassword,
  confirmPasswordReset,
} from "../controller/password.controller.js";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/password.validator.js";

const router = Router();

const passwordRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/forgot-password",
  passwordRecoveryLimiter,
  validate(forgotPasswordSchema),
  (req, res, next) => {
    console.log("Validated body:", req._validatedBody);
    next();
  },
  forgotPassword,
);

router.post(
  "/reset-password",
  passwordRecoveryLimiter,
  validate(resetPasswordSchema),
  confirmPasswordReset,
);

export default router;
