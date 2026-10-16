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
        AND tm.user_id = $3
       INNER JOIN project_members AS pm
         ON pm.project_id = p.id
        AND pm.user_id = $3
       WHERE p.id = $1
         AND p.team_id = $2
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
      [
        projectId,
        title,
        description ?? null,
        status,
        priority,
        dueDate ?? null,
        userId,
      ],
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
  page = 1,
  limit = 10,
  status,
  priority,
  search = "",
}) {
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

  const assigneesResult = await pool.query(
    `SELECT u.id, u.email
     FROM task_assignees AS ta
     INNER JOIN users AS u
       ON u.id = ta.user_id
     WHERE ta.task_id = $1
     ORDER BY u.email ASC`,
    [taskId],
  );

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

export async function updateTask({
  teamId,
  projectId,
  taskId,
  userId,
  updates = {},
}) {
  const allowedFields = [
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
  ];

  const columnMap = {
    title: "title",
    description: "description",
    status: "status",
    priority: "priority",
    dueDate: "due_date",
  };

  const entries = Object.entries(updates).filter(
    ([key, value]) => allowedFields.includes(key) && value !== undefined,
  );

  if (entries.length === 0) {
    const error = new Error("No valid fields provided to update");
    error.statusCode = 400;
    throw error;
  }

  const values = [taskId, projectId, teamId, userId];

  const setClause = entries
    .map(([key, value]) => {
      values.push(value);
      return `${columnMap[key]} = $${values.length}`;
    })
    .join(", ");

  const result = await pool.query(
    `UPDATE tasks AS t
     SET ${setClause},
         updated_at = NOW()
     FROM projects AS p
     WHERE t.id = $1
       AND t.project_id = $2
       AND p.id = t.project_id
       AND p.team_id = $3
       AND EXISTS (
         SELECT 1
         FROM team_members AS tm
         INNER JOIN project_members AS pm
           ON pm.project_id = t.project_id
          AND pm.user_id = tm.user_id
         WHERE tm.team_id = p.team_id
           AND tm.user_id = $4
       )
     RETURNING t.*`,
    values,
  );

  if (result.rowCount === 0) {
    const error = new Error("Task not found or access denied");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

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

    const taskResult = await client.query(
      `SELECT t.id
       FROM tasks AS t
       INNER JOIN projects AS p
         ON p.id = t.project_id
       INNER JOIN team_members AS tm
         ON tm.team_id = p.team_id
        AND tm.user_id = $4
       INNER JOIN project_members AS pm
         ON pm.project_id = p.id
        AND pm.user_id = $4
       WHERE t.id = $1
         AND p.id = $2
         AND p.team_id = $3
       FOR UPDATE OF t`,
      [taskId, projectId, teamId, actorId],
    );

    if (taskResult.rowCount === 0) {
      const error = new Error("Task not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    const memberResult = await client.query(
      `SELECT pm.user_id
       FROM project_members AS pm
       INNER JOIN projects AS p
         ON p.id = pm.project_id
       INNER JOIN team_members AS tm
         ON tm.team_id = p.team_id
        AND tm.user_id = pm.user_id
       WHERE pm.project_id = $1
         AND p.team_id = $2
         AND pm.user_id = $3`,
      [projectId, teamId, userId],
    );

    if (memberResult.rowCount === 0) {
      const error = new Error(
        "Assignee must be a member of this team and project",
      );
      error.statusCode = 400;
      throw error;
    }

    const existingResult = await client.query(
      `SELECT 1
       FROM task_assignees
       WHERE task_id = $1
         AND user_id = $2`,
      [taskId, userId],
    );

    if (existingResult.rowCount > 0) {
      const error = new Error("User is already assigned to this task");
      error.statusCode = 409;
      throw error;
    }

    const insertResult = await client.query(
      `INSERT INTO task_assignees (task_id, user_id)
       VALUES ($1, $2)
       RETURNING task_id, user_id`,
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
      `SELECT t.id
       FROM tasks AS t
       INNER JOIN projects AS p
         ON p.id = t.project_id
       INNER JOIN team_members AS tm
         ON tm.team_id = p.team_id
        AND tm.user_id = $4
       INNER JOIN project_members AS pm
         ON pm.project_id = p.id
        AND pm.user_id = $4
       WHERE t.id = $1
         AND p.id = $2
         AND p.team_id = $3
       FOR UPDATE OF t`,
      [taskId, projectId, teamId, actorId],
    );

    if (taskResult.rowCount === 0) {
      const error = new Error("Task not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    const deleteResult = await client.query(
      `DELETE FROM task_assignees
       WHERE task_id = $1
         AND user_id = $2
       RETURNING task_id, user_id`,
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

export async function deleteTask({ teamId, projectId, taskId, userId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      `SELECT t.id
       FROM tasks AS t
       INNER JOIN projects AS p
         ON p.id = t.project_id
       INNER JOIN team_members AS tm
         ON tm.team_id = p.team_id
        AND tm.user_id = $4
       INNER JOIN project_members AS pm
         ON pm.project_id = p.id
        AND pm.user_id = $4
       WHERE t.id = $1
         AND p.id = $2
         AND p.team_id = $3
       FOR UPDATE OF t`,
      [taskId, projectId, teamId, userId],
    );

    if (taskResult.rowCount === 0) {
      const error = new Error("Task not found or access denied");
      error.statusCode = 404;
      throw error;
    }

    await client.query("DELETE FROM task_assignees WHERE task_id = $1", [
      taskId,
    ]);

    await client.query("DELETE FROM comments WHERE task_id = $1", [taskId]);

    const deleteResult = await client.query(
      `DELETE FROM tasks
       WHERE id = $1
       RETURNING id, project_id, title`,
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

// Task comments

export async function createTaskComment({
  teamId,
  projectId,
  taskId,
  userId,
  content,
}) {
  const result = await pool.query(
    `INSERT INTO comments (task_id, user_id, content)
     SELECT t.id, $4, $5
     FROM tasks AS t
     INNER JOIN projects AS p
       ON p.id = t.project_id
     INNER JOIN team_members AS tm
       ON tm.team_id = p.team_id
      AND tm.user_id = $4
     INNER JOIN project_members AS pm
       ON pm.project_id = p.id
      AND pm.user_id = $4
     WHERE t.id = $1
       AND p.id = $2
       AND p.team_id = $3
     RETURNING id, task_id, user_id, content, created_at, updated_at`,
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
    `SELECT t.id
     FROM tasks AS t
     INNER JOIN projects AS p
       ON p.id = t.project_id
     INNER JOIN team_members AS tm
       ON tm.team_id = p.team_id
      AND tm.user_id = $4
     INNER JOIN project_members AS pm
       ON pm.project_id = p.id
      AND pm.user_id = $4
     WHERE t.id = $1
       AND p.id = $2
       AND p.team_id = $3`,
    [taskId, projectId, teamId, userId],
  );

  if (accessResult.rowCount === 0) {
    const error = new Error("Task not found or access denied");
    error.statusCode = 404;
    throw error;
  }

  const result = await pool.query(
    `SELECT c.id, c.task_id, c.user_id, c.content,
            c.created_at, c.updated_at
     FROM comments AS c
     WHERE c.task_id = $1
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $2 OFFSET $3`,
    [taskId, limit, offset],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM comments
     WHERE task_id = $1`,
    [taskId],
  );

  const total = countResult.rows[0].total;

  return {
    comments: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
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
    `UPDATE comments AS c
     SET content = $6, updated_at = NOW()
     FROM tasks AS t, projects AS p
     WHERE c.id = $1
       AND c.task_id = t.id
       AND t.project_id = p.id
       AND p.id = $2
       AND p.team_id = $3
       AND c.task_id = $4
       AND c.user_id = $5
       AND EXISTS (
         SELECT 1
         FROM team_members AS tm
         INNER JOIN project_members AS pm
           ON pm.project_id = p.id
          AND pm.user_id = tm.user_id
         WHERE tm.team_id = p.team_id
           AND tm.user_id = $5
       )
     RETURNING c.id, c.task_id, c.user_id, c.content,
               c.created_at, c.updated_at`,
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
    `DELETE FROM comments AS c
     USING tasks AS t, projects AS p
     WHERE c.id = $1
       AND c.task_id = t.id
       AND t.project_id = p.id
       AND p.id = $2
       AND p.team_id = $3
       AND c.task_id = $4
       AND c.user_id = $5
       AND EXISTS (
         SELECT 1
         FROM team_members AS tm
         INNER JOIN project_members AS pm
           ON pm.project_id = p.id
          AND pm.user_id = tm.user_id
         WHERE tm.team_id = p.team_id
           AND tm.user_id = $5
       )
     RETURNING c.id, c.task_id, c.user_id`,
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
