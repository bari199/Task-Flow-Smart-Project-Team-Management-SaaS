import { pool } from "../config/database.js";

export async function createNotification({
  eventId,
  recipientUserId,
  actorUserId,
  type,
  title,
  message,
  data = {},
  taskId,
}) {
  const result = await pool.query(
    `
    INSERT INTO notifications (
      event_id,
      recipient_id,
      actor_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb
    )
    ON CONFLICT (event_id)
      WHERE event_id IS NOT NULL
    DO NOTHING
    RETURNING
      id,
      recipient_id,
      actor_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      metadata,
      read_at,
      created_at
    `,
    [
      eventId,
      recipientUserId,
      actorUserId ?? null,
      type,
      title,
      message,
      "task",
      taskId,
      JSON.stringify(data),
    ],
  );

  return result.rows[0] ?? null;
}

export async function listNotifications({
  userId,
  page = 1,
  limit = 20,
  unreadOnly = false,
}) {
  const offset = (page - 1) * limit;

  const filter = unreadOnly ? "AND read_at IS NULL" : "";

  const [listResult, countResult] = await Promise.all([
    pool.query(
      `
      SELECT
        id,
        recipient_id,
        actor_id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        metadata,
        read_at,
        created_at
      FROM notifications
      WHERE recipient_id = $1
        ${filter}
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset],
    ),

    pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM notifications
      WHERE recipient_id = $1
        ${filter}
      `,
      [userId],
    ),
  ]);

  const total = countResult.rows[0].total;

  return {
    notifications: listResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function countUnreadNotifications(userId) {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE recipient_id = $1
      AND read_at IS NULL
    `,
    [userId],
  );

  return result.rows[0].count;
}

export async function markNotificationRead({ notificationId, userId }) {
  const result = await pool.query(
    `
    UPDATE notifications
    SET read_at = COALESCE(read_at, NOW())
    WHERE id = $1
      AND recipient_id = $2
    RETURNING id, read_at
    `,
    [notificationId, userId],
  );

  if (result.rowCount === 0) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

export async function markAllNotificationsRead(userId) {
  const result = await pool.query(
    `
    UPDATE notifications
    SET read_at = NOW()
    WHERE recipient_id = $1
      AND read_at IS NULL
    RETURNING id
    `,
    [userId],
  );

  return {
    updatedCount: result.rowCount,
  };
}

export async function deleteNotification({ notificationId, userId }) {
  const result = await pool.query(
    `
    DELETE FROM notifications
    WHERE id = $1
      AND recipient_id = $2
    RETURNING id
    `,
    [notificationId, userId],
  );

  if (result.rowCount === 0) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}
