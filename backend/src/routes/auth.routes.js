import { Router } from "express";
import rateLimit from "express-rate-limit";

import { validate } from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

import {
  register,
  verifyEmail,
  resendVerification,
  login,
  getMe,
  logout,
} from "../controller/auth.controller.js";

import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
} from "../validators/auth.validator.js";
import {
  loginRateLimiter,
  otpRateLimiter,
} from "../middlewares/rate.limit.middleware.js";

const router = Router();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 10,
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// const otpLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 5,
//   standardHeaders: true,
//   legacyHeaders: false,
// });

router.post(
  "/register",
  registrationLimiter,
  validate(registerSchema),
  register,
);

router.post(
  "/verify-email",
  otpRateLimiter,
  validate(verifyEmailSchema),
  verifyEmail,
);

router.post(
  "/resend-verification",
  otpRateLimiter,
  validate(resendOtpSchema),
  resendVerification,
);

router.post("/login", loginRateLimiter, validate(loginSchema), login);

router.get("/me", authenticate, getMe);

router.post("/logout", authenticate, logout);

export default router;
