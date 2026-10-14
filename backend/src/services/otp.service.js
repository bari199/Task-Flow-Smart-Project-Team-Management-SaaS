import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { pool } from "../config/database.js";

const hashOtp = (userId, otp) =>
  createHmac("sha256", process.env.OTP_SECRET)
    .update(`${userId}:${otp}`)
    .digest("hex");

const matchesOtp = (userId, otp, storedHash) => {
  const actual = Buffer.from(hashOtp(userId, otp), "hex");
  const expected = Buffer.from(storedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const createEmailOtp = async (userId, purpose) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE email_otps
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND purpose = $2
         AND consumed_at IS NULL`,
      [userId, purpose],
    );

    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otpHash = hashOtp(userId, otp);

    await client.query(
      `INSERT INTO email_otps
         (user_id, purpose, otp_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
      [userId, purpose, otpHash],
    );

    await client.query("COMMIT");

    return otp;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const consumeEmailOtp = async (userId, purpose, otp) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, otp_hash, attempts
       FROM email_otps
       WHERE user_id = $1
         AND purpose = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()
         AND attempts < 5
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId, purpose],
    );

    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return false;
    }

    const record = result.rows[0];

    if (!matchesOtp(userId, otp, record.otp_hash)) {
      await client.query(
        `UPDATE email_otps
         SET attempts = attempts + 1,
             consumed_at = CASE
               WHEN attempts + 1 >= 5 THEN NOW()
               ELSE consumed_at
             END
         WHERE id = $1`,
        [record.id],
      );

      await client.query("COMMIT");
      return false;
    }

    await client.query(
      "UPDATE email_otps SET consumed_at = NOW() WHERE id = $1",
      [record.id],
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
