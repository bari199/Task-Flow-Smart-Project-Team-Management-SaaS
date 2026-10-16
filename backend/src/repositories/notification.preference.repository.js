import { pool } from "../config/database.js";

// Adjust the pool import above to match your existing database config.

const DEFAULT_PREFERENCES = {
  in_app_enabled: true,
  email_enabled: true,
  task_reminders_enabled: true,
  security_alerts_enabled: true,
};

export const getPreferencesByUserId = async (userId) => {
  await pool.query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  const result = await pool.query(
    `SELECT
       user_id,
       in_app_enabled,
       email_enabled,
       task_reminders_enabled,
       security_alerts_enabled,
       updated_at
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0];
};

export const updatePreferencesByUserId = async (userId, preferences) => {
  const allowedColumns = [
    "in_app_enabled",
    "email_enabled",
    "task_reminders_enabled",
    "security_alerts_enabled",
  ];

  const entries = Object.entries(preferences).filter(([key]) =>
    allowedColumns.includes(key),
  );

  // Create a default row if this user has no preferences yet.
  await pool.query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  if (entries.length === 0) {
    return getPreferencesByUserId(userId);
  }

  const values = [userId];
  const assignments = entries.map(([key, value], index) => {
    values.push(value);
    return `${key} = $${index + 2}`;
  });

  const result = await pool.query(
    `UPDATE notification_preferences
     SET ${assignments.join(", ")},
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING
       user_id,
       in_app_enabled,
       email_enabled,
       task_reminders_enabled,
       security_alerts_enabled,
       updated_at`,
    values,
  );

  return result.rows[0];
};

export { DEFAULT_PREFERENCES };
