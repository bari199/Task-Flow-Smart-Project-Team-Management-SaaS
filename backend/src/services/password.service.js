import { createHash, randomBytes } from "node:crypto";

import argon2 from "argon2";

import { pool } from "../config/database.js";
import { sendPasswordResetLink } from "./email.service.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export const requestPasswordReset = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, email
     FROM users
     WHERE email = $1
       AND status = 'active'
       AND password_hash IS NOT NULL`,
    [normalizedEmail],
  );

  // Unknown accounts receive the same public response.
  if (result.rowCount === 0) return;

  const user = result.rows[0];

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Only one active reset token per user.
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [user.id],
    );

    await client.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [user.id, tokenHash],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await sendPasswordResetLink(user.email, rawToken);
};

export const resetPassword = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const passwordHash = await argon2.hash(password);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const reset = result.rows[0];

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, reset.user_id],
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [reset.user_id],
    );

    // Revoke all existing sessions for this user.
    await client.query(
      `DELETE FROM user_sessions
       WHERE sess->>'userId' = $1`,
      [reset.user_id],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
