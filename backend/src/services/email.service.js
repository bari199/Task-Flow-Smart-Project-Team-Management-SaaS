export const sendVerificationOtp = async (email, otp) => {
  if (process.env.NODE_ENV === "development") {
    console.info(`[DEV ONLY] Verification OTP for ${email}: ${otp}`);
    return;
  }

  throw new Error("Email provider is not configured");
};

export const sendPasswordResetLink = async (email, token) => {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Email provider is not configured");
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const resetUrl = new URL("/reset-password", frontendUrl);
  resetUrl.searchParams.set("token", token);

  console.info(
    `[DEV ONLY] Password reset link for ${email}: ${resetUrl.toString()}`,
  );
};
