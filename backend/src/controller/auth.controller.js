import { pool } from "../config/database.js";

import {
  registerUser,
  verifyUserEmail,
  authenticateUser,
} from "../services/auth.service.js";

import { createEmailOtp } from "../services/otp.service.js";
import { sendVerificationOtp } from "../services/email.service.js";

const saveSession = (session) =>
  new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) return reject(error);
      resolve();
    });
  });

// Register
export const register = async (req, res, next) => {
  try {
    const user = await registerUser(req._validatedBody);

    // Find the newly registered user
    const result = await pool.query(
      `SELECT id, email
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [user.email],
    );

    if (result.rowCount > 0) {
      const registeredUser = result.rows[0];

      const otp = await createEmailOtp(registeredUser.id, "verify_email");

      await sendVerificationOtp(registeredUser.email, otp);
    }

    return res.status(201).json({
      success: true,
      message: "Registration received. Verify your email to continue.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Verify email
export const verifyEmail = async (req, res, next) => {
  try {
    const valid = await verifyUserEmail(req._validatedBody);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification OTP
export const resendVerification = async (req, res, next) => {
  try {
    const email = req._validatedBody.email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, email
       FROM users
       WHERE email = $1
         AND email_verified = FALSE
         AND status = 'active'
       LIMIT 1`,
      [email],
    );

    // Return the same response whether the account exists or not
    if (result.rowCount === 0) {
      return res.status(200).json({
        success: true,
        message: "If verification is available, a new code will be sent.",
      });
    }

    const user = result.rows[0];

    const recentOtp = await pool.query(
      `SELECT created_at
       FROM email_otps
       WHERE user_id = $1
         AND purpose = 'verify_email'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );

    const lastCreatedAt = recentOtp.rows[0]?.created_at;

    const cooldownActive =
      lastCreatedAt && Date.now() - new Date(lastCreatedAt).getTime() < 60_000;

    if (cooldownActive) {
      const remainingSeconds = Math.ceil(
        (60_000 - (Date.now() - new Date(lastCreatedAt).getTime())) / 1000,
      );

      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
        retryAfter: remainingSeconds,
      });
    }

    const otp = await createEmailOtp(user.id, "verify_email");

    await sendVerificationOtp(user.email, otp);

    return res.status(200).json({
      success: true,
      message: "If verification is available, a new code will be sent.",
    });
  } catch (error) {
    next(error);
  }
};

// Login
export const login = async (req, res, next) => {
  try {
    const user = await authenticateUser(req._validatedBody);

    req.session.regenerate(async (error) => {
      if (error) return next(error);

      req.session.userId = user.id;

      try {
        await saveSession(req.session);

        return res.status(200).json({
          success: true,
          message: "Login successful",
          data: { user },
        });
      } catch (saveError) {
        next(saveError);
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

// Logout
export const logout = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie(process.env.SESSION_COOKIE_NAME || "taskflow.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  });
};
