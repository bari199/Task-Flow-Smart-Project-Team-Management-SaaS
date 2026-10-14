import argon2 from "argon2";

import { pool } from "../config/database.js";
import { createEmailOtp, consumeEmailOtp } from "./otp.service.js";
import { sendVerificationOtp } from "./email.service.js";

export const registerUser = async ({ fullName, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password);

  let user;

  try {
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, email_verified, created_at`,
      [fullName.trim(), normalizedEmail, passwordHash],
    );

    user = result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const conflict = new Error(
        "An account with this email may already exist.",
      );
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }

  const otp = await createEmailOtp(user.id, "verify_email");
  await sendVerificationOtp(user.email, otp);

  return user;
};

export const verifyUserEmail = async ({ email, otp }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, email_verified
     FROM users
     WHERE email = $1 AND status = 'active'`,
    [normalizedEmail],
  );

  if (result.rowCount === 0 || result.rows[0].email_verified) {
    return false;
  }

  const user = result.rows[0];

  const valid = await consumeEmailOtp(user.id, "verify_email", otp);

  if (!valid) return false;

  await pool.query(
    `UPDATE users
     SET email_verified = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [user.id],
  );

  return true;
};

export const authenticateUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, full_name, email, password_hash,
            email_verified, status
     FROM users
     WHERE email = $1`,
    [normalizedEmail],
  );

  const user = result.rows[0];

  if (
    !user ||
    !user.password_hash ||
    !(await argon2.verify(user.password_hash, password))
  ) {
    const error = new Error("Invalid email or password");
    error.status = 401;
    throw error;
  }

  if (user.status !== "active") {
    const error = new Error("This account is unavailable");
    error.status = 403;
    throw error;
  }

  if (!user.email_verified) {
    const error = new Error("Please verify your email before logging in");
    error.status = 403;
    throw error;
  }

  const { password_hash, ...safeUser } = user;
  return safeUser;
};
