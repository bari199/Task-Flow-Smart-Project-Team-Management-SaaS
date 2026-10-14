import { pool } from "../config/database.js";

export const resolveOAuthUser = async (provider, profile) => {
  const providerUserId = profile.id;

  if (!providerUserId) {
    throw new Error("Provider did not return a user ID");
  }

  const email = profile.emails?.[0]?.value?.trim().toLowerCase() || null;
  const name = profile.displayName?.trim() || `${provider} user`;
  const avatar = profile.photos?.[0]?.value || null;

  // Trust email verification only when the provider explicitly
  // returns a verified-email claim.
  const emailVerified =
    Boolean(email) &&
    (profile._json?.email_verified === true ||
      profile._json?.email_verified === "true");

  const existing = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.email_verified
     FROM auth_accounts a
     JOIN users u ON u.id = a.user_id
     WHERE a.provider = $1 AND a.provider_user_id = $2`,
    [provider, providerUserId],
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  // Never silently link a social identity to an existing account
  // merely because the email addresses match.
  if (email) {
    const emailExists = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );

    if (emailExists.rowCount > 0) {
      const error = new Error(
        "An account with this email already exists. Sign in to that account first.",
      );
      error.status = 409;
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users
         (full_name, email, avatar_url, email_verified)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, email_verified`,
      [name, email, avatar, emailVerified],
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO auth_accounts (user_id, provider, provider_user_id)
       VALUES ($1, $2, $3)`,
      [user.id, provider, providerUserId],
    );

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const conflict = new Error(
        "This account could not be linked automatically. Please sign in and try again.",
      );
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  } finally {
    client.release();
  }
};
