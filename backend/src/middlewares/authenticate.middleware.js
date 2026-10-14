import { pool } from "../config/database.js";

export const authenticate = async (req, res, next) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await pool.query(
      `SELECT
  u.id,
  u.full_name,
  u.email,
  u.avatar_url,
  u.email_verified,
  EXISTS (
    SELECT 1
    FROM auth_accounts a
    WHERE a.user_id = u.id
  ) AS has_oauth_account
FROM users u
WHERE u.id = $1 AND u.status = 'active'`,
      [userId],
    );

    if (result.rowCount === 0) {
      return req.session.destroy(() => {
        res.status(401).json({
          success: false,
          message: "Session is no longer valid",
        });
      });
    }

    if (!result.rows[0].email_verified && !result.rows[0].has_oauth_account) {
      return res.status(403).json({
        success: false,
        message: "Email verification required",
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
};
