// Import the existing PostgreSQL pool from your project.
// Example path only; match your existing repository.

export async function createTaskComment({
  teamId,
  projectId,
  taskId,
  userId,
  content,
}) {
  const result = await pool.query(
    `
    INSERT INTO comments (task_id, user_id, content)
    SELECT t.id, $4, $5
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN team_members tm
      ON tm.team_id = p.team_id
     AND tm.user_id = $4
    JOIN project_members pm
      ON pm.project_id = p.id
     AND pm.user_id = $4
    WHERE t.id = $1
      AND p.id = $2
      AND p.team_id = $3
    RETURNING id, task_id, user_id, content, created_at, updated_at
    `,
    [taskId, projectId, teamId, userId, content],
  );

  if (result.rowCount === 0) {
    const error = new Error("Task not found or access denied");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

export async function listTaskComments({
  teamId,
  projectId,
  taskId,
  userId,
  page = 1,
  limit = 20,
}) {
  const offset = (page - 1) * limit;

  const accessResult = await pool.query(
    `
    SELECT t.id
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN team_members tm
      ON tm.team_id = p.team_id
     AND tm.user_id = $4
    JOIN project_members pm
      ON pm.project_id = p.id
     AND pm.user_id = $4
    WHERE t.id = $1
      AND p.id = $2
      AND p.team_id = $3
    `,
    [taskId, projectId, teamId, userId],
  );

  if (accessResult.rowCount === 0) {
    const error = new Error("Task not found or access denied");
    error.statusCode = 404;
    throw error;
  }

  const result = await pool.query(
    `
    SELECT
      c.id,
      c.task_id,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at
    FROM comments c
    WHERE c.task_id = $1
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT $2 OFFSET $3
    `,
    [taskId, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM comments WHERE task_id = $1`,
    [taskId],
  );

  return {
    comments: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}

export async function updateTaskComment({
  teamId,
  projectId,
  taskId,
  commentId,
  userId,
  content,
}) {
  const result = await pool.query(
    `
    UPDATE comments c
    SET content = $6, updated_at = NOW()
    FROM tasks t, projects p
    WHERE c.id = $1
      AND c.task_id = t.id
      AND t.project_id = p.id
      AND p.id = $2
      AND p.team_id = $3
      AND c.task_id = $4
      AND c.user_id = $5
      AND EXISTS (
        SELECT 1
        FROM team_members tm
        JOIN project_members pm
          ON pm.project_id = p.id
         AND pm.user_id = tm.user_id
        WHERE tm.team_id = p.team_id
          AND tm.user_id = $5
      )
    RETURNING c.id, c.task_id, c.user_id, c.content,
              c.created_at, c.updated_at
    `,
    [commentId, projectId, teamId, taskId, userId, content],
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "Comment not found or you do not have permission to edit it",
    );
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

export async function deleteTaskComment({
  teamId,
  projectId,
  taskId,
  commentId,
  userId,
}) {
  const result = await pool.query(
    `
    DELETE FROM comments c
    USING tasks t, projects p
    WHERE c.id = $1
      AND c.task_id = t.id
      AND t.project_id = p.id
      AND p.id = $2
      AND p.team_id = $3
      AND c.task_id = $4
      AND c.user_id = $5
      AND EXISTS (
        SELECT 1
        FROM team_members tm
        JOIN project_members pm
          ON pm.project_id = p.id
         AND pm.user_id = tm.user_id
        WHERE tm.team_id = p.team_id
          AND tm.user_id = $5
      )
    RETURNING c.id, c.task_id, c.user_id
    `,
    [commentId, projectId, teamId, taskId, userId],
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "Comment not found or you do not have permission to delete it",
    );
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}
