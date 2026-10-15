import { pool } from "../config/database.js";

export async function createTask({
  teamId,
  projectId,
  userId,
  title,
  description,
  priority,
  status,
  dueDate,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `SELECT p.id
       FROM projects AS p
       INNER JOIN team_members AS tm
         ON tm.team_id = p.team_id
       INNER JOIN project_members AS pm
         ON pm.project_id = p.id
        AND pm.user_id = tm.user_id
       WHERE p.id = $1
         AND p.team_id = $2
         AND tm.user_id = $3
       FOR UPDATE OF p`,
      [projectId, teamId, userId],
    );

    if (!projectResult.rows[0]) {
      const error = new Error(
        "Project not found or you are not a project member",
      );
      error.statusCode = 404;
      throw error;
    }

    const result = await client.query(
      `INSERT INTO tasks (
         project_id,
         title,
         description,
         status,
         priority,
         due_date,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [projectId, title, description, status, priority, dueDate, userId],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findTasksByProject({
  teamId,
  projectId,
  userId,
  page,
  limit,
  status,
  priority,
  search,
}) {
  // Check both team membership and project membership.
  const accessResult = await pool.query(
    `SELECT 1
     FROM projects AS p
     INNER JOIN team_members AS tm
       ON tm.team_id = p.team_id
      AND tm.user_id = $3
     INNER JOIN project_members AS pm
       ON pm.project_id = p.id
      AND pm.user_id = $3
     WHERE p.id = $1
       AND p.team_id = $2
     LIMIT 1`,
    [projectId, teamId, userId],
  );

  if (!accessResult.rows[0]) {
    return null;
  }

  const offset = (page - 1) * limit;

  const filterParams = [projectId, status ?? null, priority ?? null, search];

  const filterSql = `
    WHERE t.project_id = $1
      AND ($2::text IS NULL OR t.status = $2)
      AND ($3::text IS NULL OR t.priority = $3)
      AND (
        $4 = ''
        OR t.title ILIKE '%' || $4 || '%'
        OR COALESCE(t.description, '') ILIKE '%' || $4 || '%'
      )
  `;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM tasks AS t
     ${filterSql}`,
    filterParams,
  );

  const tasksResult = await pool.query(
    `SELECT t.*
     FROM tasks AS t
     ${filterSql}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $5 OFFSET $6`,
    [...filterParams, limit, offset],
  );

  const total = countResult.rows[0].total;

  return {
    tasks: tasksResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + tasksResult.rows.length < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function findTaskDetails({ teamId, projectId, taskId, userId }) {
  // Verify access and retrieve the task.
  const taskResult = await pool.query(
    `SELECT t.*
     FROM tasks AS t
     INNER JOIN projects AS p
       ON p.id = t.project_id
     INNER JOIN team_members AS tm
       ON tm.team_id = p.team_id
      AND tm.user_id = $4
     INNER JOIN project_members AS pm
       ON pm.project_id = p.id
      AND pm.user_id = $4
     WHERE p.team_id = $1
       AND p.id = $2
       AND t.id = $3
     LIMIT 1`,
    [teamId, projectId, taskId, userId],
  );

  const task = taskResult.rows[0];

  if (!task) {
    return null;
  }

  // Fetch assigned users.
  const assigneesResult = await pool.query(
    `SELECT u.id, u.email
     FROM task_assignees AS ta
     INNER JOIN users AS u
       ON u.id = ta.user_id
     WHERE ta.task_id = $1
     ORDER BY u.email ASC`,
    [taskId],
  );

  // Return comment count without exposing comment contents.
  const commentsResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM comments
     WHERE task_id = $1`,
    [taskId],
  );

  return {
    ...task,
    assignees: assigneesResult.rows,
    commentCount: commentsResult.rows[0].total,
  };
}

// Reuse the same PostgreSQL pool already used
// by the other task repository functions.

export async function assignTaskUser({
  teamId,
  projectId,
  taskId,
  userId,
  actorId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify the task exists and the actor belongs
    // to both the team and the project.
    const taskResult = await client.query(
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
      FOR UPDATE OF t
      `,
      [taskId, projectId, teamId, actorId],
    );

    if (taskResult.rowCount === 0) {
      const error = new Error("Task not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    // Target user must also belong to the team
    // and project.
    const memberResult = await client.query(
      `
      SELECT pm.user_id
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      JOIN team_members tm
        ON tm.team_id = p.team_id
       AND tm.user_id = pm.user_id
      WHERE pm.project_id = $1
        AND p.team_id = $2
        AND pm.user_id = $3
      `,
      [projectId, teamId, userId],
    );

    if (memberResult.rowCount === 0) {
      const error = new Error(
        "Assignee must be a member of this team and project",
      );
      error.statusCode = 400;
      throw error;
    }

    // Prevent duplicate assignments.
    const existingResult = await client.query(
      `
      SELECT 1
      FROM task_assignees
      WHERE task_id = $1
        AND user_id = $2
      `,
      [taskId, userId],
    );

    if (existingResult.rowCount > 0) {
      const error = new Error("User is already assigned to this task");
      error.statusCode = 409;
      throw error;
    }

    const insertResult = await client.query(
      `
      INSERT INTO task_assignees (task_id, user_id)
      VALUES ($1, $2)
      RETURNING task_id, user_id
      `,
      [taskId, userId],
    );

    await client.query("COMMIT");

    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function unassignTaskUser({
  teamId,
  projectId,
  taskId,
  userId,
  actorId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
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
      FOR UPDATE OF t
      `,
      [taskId, projectId, teamId, actorId],
    );

    if (taskResult.rowCount === 0) {
      const error = new Error("Task not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    const deleteResult = await client.query(
      `
      DELETE FROM task_assignees
      WHERE task_id = $1
        AND user_id = $2
      RETURNING task_id, user_id
      `,
      [taskId, userId],
    );

    if (deleteResult.rowCount === 0) {
      const error = new Error("This user is not assigned to the task");
      error.statusCode = 404;
      throw error;
    }

    await client.query("COMMIT");

    return deleteResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

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
export async function deleteTask({ teamId, projectId, taskId, userId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify task and actor's team/project membership.
    const taskResult = await client.query(
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
      FOR UPDATE OF t
      `,
      [taskId, projectId, teamId, userId],
    );

    if (taskResult.rowCount === 0) {
      const error = new Error("Task not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    // Remove known dependent records first.
    // These table/column names must match your migrations.
    await client.query(`DELETE FROM task_assignees WHERE task_id = $1`, [
      taskId,
    ]);

    await client.query(`DELETE FROM comments WHERE task_id = $1`, [taskId]);

    // If attachments has a task_id foreign key without
    // ON DELETE CASCADE, delete those rows here as well.
    // Only add that query after confirming the schema.

    const deleteResult = await client.query(
      `
      DELETE FROM tasks
      WHERE id = $1
      RETURNING id, project_id, title
      `,
      [taskId],
    );

    await client.query("COMMIT");

    return deleteResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
