import {
  requestPasswordReset,
  resetPassword,
} from "../services/password.service.js";

// Forgot Password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req._validatedBody;

    await requestPasswordReset(email);

    // Use the same response for existing and non-existing accounts.
    return res.status(200).json({
      success: true,
      message:
        "If an eligible account exists, password reset instructions will be sent.",
    });
  } catch (error) {
    return next(error);
  }
};

// Confirm Password Reset
export const confirmPasswordReset = async (req, res, next) => {
  try {
    const { token, password } = req._validatedBody;

    const success = await resetPassword({
      token,
      password,
    });

    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (error) {
    return next(error);
  }
};
