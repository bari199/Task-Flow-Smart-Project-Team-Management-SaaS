const requiredVariables = [
  "DATABASE_URL",
  "REDIS_URL",
  "SESSION_SECRET",
  "OTP_SECRET",
];

export const validateEnv = () => {
  const missingVariables = requiredVariables.filter((key) => !process.env[key]);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingVariables.join(", ")}`,
    );
  }

  for (const key of ["SESSION_SECRET", "OTP_SECRET"]) {
    if (process.env[key].length < 32) {
      throw new Error(`${key} must be at least 32 characters`);
    }
  }

  const port = Number(process.env.PORT || 8000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port");
  }

  return {
    port,

    nodeEnv: process.env.NODE_ENV || "development",

    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

    sessionSecret: process.env.SESSION_SECRET,

    sessionCookieName: process.env.SESSION_COOKIE_NAME || "taskflow.sid",
  };
};
