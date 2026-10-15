import { pool } from "../config/database.js";

function makeSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export async function createProject({ teamId, userId, name, description }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const permissionResult = await client.query(
      `SELECT role
       FROM team_members
       WHERE team_id = $1 AND user_id = $2
       FOR UPDATE`,
      [teamId, userId],
    );

    const membership = permissionResult.rows[0];

    if (!membership) {
      const error = new Error("Team not found or you are not a team member");
      error.statusCode = 404;
      throw error;
    }

    if (!["owner", "admin"].includes(membership.role)) {
      const error = new Error(
        "Only team owners and admins can create projects",
      );
      error.statusCode = 403;
      throw error;
    }

    const baseSlug = makeSlug(name) || "project";
    let slug = baseSlug;
    let suffix = 1;
    let project;

    // Generate a unique slug within the team.
    while (true) {
      const result = await client.query(
        `INSERT INTO projects (
           team_id,
           name,
           slug,
           description
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING
           id, team_id, name, slug, description,
           created_at, updated_at`,
        [teamId, name, slug, description],
      );

      if (result.rows[0]) {
        project = result.rows[0];
        break;
      }

      slug = `${baseSlug}-${suffix++}`;

      if (suffix > 100) {
        throw new Error("Unable to generate a unique project slug");
      }
    }

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [project.id, userId, "admin"],
    );

    await client.query("COMMIT");

    return project;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findProjectsByTeam({
  teamId,
  userId,
  page,
  limit,
  search,
}) {
  // Verify that the user belongs to this team.
  const membershipResult = await pool.query(
    `SELECT 1
     FROM team_members
     WHERE team_id = $1 AND user_id = $2
     LIMIT 1`,
    [teamId, userId],
  );

  if (!membershipResult.rows[0]) {
    return null;
  }

  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM projects AS p
     WHERE p.team_id = $1
       AND (
         $2 = ''
         OR p.name ILIKE '%' || $2 || '%'
         OR COALESCE(p.description, '') ILIKE '%' || $2 || '%'
       )`,
    [teamId, search],
  );

  const projectsResult = await pool.query(
    `SELECT
       p.id,
       p.team_id,
       p.name,
       p.slug,
       p.description,
       p.created_at,
       p.updated_at
     FROM projects AS p
     WHERE p.team_id = $1
       AND (
         $2 = ''
         OR p.name ILIKE '%' || $2 || '%'
         OR COALESCE(p.description, '') ILIKE '%' || $2 || '%'
       )
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $3 OFFSET $4`,
    [teamId, search, limit, offset],
  );

  const total = countResult.rows[0].total;

  return {
    projects: projectsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: offset + projectsResult.rows.length < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function findProjectDetails({ teamId, projectId, userId }) {
  // Verify team membership and fetch the requested project.
  const projectResult = await pool.query(
    `SELECT
       p.id,
       p.team_id,
       p.name,
       p.slug,
       p.description,
       p.created_at,
       p.updated_at
     FROM projects AS p
     INNER JOIN team_members AS tm
       ON tm.team_id = p.team_id
     WHERE p.id = $1
       AND p.team_id = $2
       AND tm.user_id = $3
     LIMIT 1`,
    [projectId, teamId, userId],
  );

  const project = projectResult.rows[0];

  if (!project) {
    return null;
  }

  // Fetch project members without exposing sensitive user fields.
  const membersResult = await pool.query(
    `SELECT
       u.id,
       u.email,
       pm.role
     FROM project_members AS pm
     INNER JOIN users AS u
       ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.role ASC, u.email ASC`,
    [project.id],
  );

  return {
    ...project,
    members: membersResult.rows,
  };
}

export async function addProjectMember({
  teamId,
  projectId,
  actorId,
  targetUserId,
  role,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `SELECT id
       FROM projects
       WHERE id = $1 AND team_id = $2
       FOR UPDATE`,
      [projectId, teamId],
    );

    if (!projectResult.rows[0]) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    const actorResult = await client.query(
      `SELECT
         tm.role AS team_role,
         pm.role AS project_role
       FROM team_members AS tm
       LEFT JOIN project_members AS pm
         ON pm.project_id = $1
        AND pm.user_id = tm.user_id
       WHERE tm.team_id = $2
         AND tm.user_id = $3`,
      [projectId, teamId, actorId],
    );

    const actor = actorResult.rows[0];

    if (!actor) {
      const error = new Error("Team membership not found");
      error.statusCode = 403;
      throw error;
    }

    const isTeamManager = ["owner", "admin"].includes(actor.team_role);
    const isProjectAdmin = actor.project_role === "admin";

    if (!isTeamManager && !isProjectAdmin) {
      const error = new Error("Insufficient permissions");
      error.statusCode = 403;
      throw error;
    }

    // Only a team owner/admin can grant project-admin access.
    if (role === "admin" && !isTeamManager) {
      const error = new Error(
        "Only a team owner or admin can grant project-admin access",
      );
      error.statusCode = 403;
      throw error;
    }

    const targetResult = await client.query(
      `SELECT 1
       FROM team_members
       WHERE team_id = $1 AND user_id = $2`,
      [teamId, targetUserId],
    );

    if (!targetResult.rows[0]) {
      const error = new Error(
        "The user must belong to this team before joining its project",
      );
      error.statusCode = 400;
      throw error;
    }

    const existingResult = await client.query(
      `SELECT 1
       FROM project_members
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, targetUserId],
    );

    if (existingResult.rows[0]) {
      const error = new Error("User is already a project member");
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING project_id, user_id, role`,
      [projectId, targetUserId, role],
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

export async function updateProject({
  teamId,
  projectId,
  userId,
  name,
  description,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `SELECT id
       FROM projects
       WHERE id = $1 AND team_id = $2
       FOR UPDATE`,
      [projectId, teamId],
    );

    if (!projectResult.rows[0]) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    const permissionResult = await client.query(
      `SELECT
         tm.role AS team_role,
         pm.role AS project_role
       FROM projects AS p
       LEFT JOIN team_members AS tm
         ON tm.team_id = p.team_id
        AND tm.user_id = $3
       LEFT JOIN project_members AS pm
         ON pm.project_id = p.id
        AND pm.user_id = $3
       WHERE p.id = $1
         AND p.team_id = $2
       LIMIT 1`,
      [projectId, teamId, userId],
    );

    const permission = permissionResult.rows[0];

    const canUpdate =
      ["owner", "admin"].includes(permission?.team_role) ||
      permission?.project_role === "admin";

    if (!canUpdate) {
      const error = new Error(
        "You do not have permission to update this project",
      );
      error.statusCode = 403;
      throw error;
    }

    const updateResult = await client.query(
      `UPDATE projects
       SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         updated_at = NOW()
       WHERE id = $1 AND team_id = $2
       RETURNING
         id, team_id, name, slug, description,
         created_at, updated_at`,
      [projectId, teamId, name ?? null, description ?? null],
    );

    await client.query("COMMIT");

    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function removeProjectMember({
  teamId,
  projectId,
  actorId,
  targetUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `SELECT id
       FROM projects
       WHERE id = $1 AND team_id = $2
       FOR UPDATE`,
      [projectId, teamId],
    );

    if (!projectResult.rows[0]) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    const actorResult = await client.query(
      `SELECT
         tm.role AS team_role,
         pm.role AS project_role
       FROM team_members AS tm
       LEFT JOIN project_members AS pm
         ON pm.project_id = $1
        AND pm.user_id = tm.user_id
       WHERE tm.team_id = $2
         AND tm.user_id = $3`,
      [projectId, teamId, actorId],
    );

    const actor = actorResult.rows[0];

    if (!actor) {
      const error = new Error("Team membership not found");
      error.statusCode = 403;
      throw error;
    }

    const isTeamManager = ["owner", "admin"].includes(actor.team_role);
    const isProjectAdmin = actor.project_role === "admin";

    if (!isTeamManager && !isProjectAdmin) {
      const error = new Error("Insufficient permissions");
      error.statusCode = 403;
      throw error;
    }

    const targetResult = await client.query(
      `SELECT role
       FROM project_members
       WHERE project_id = $1 AND user_id = $2
       FOR UPDATE`,
      [projectId, targetUserId],
    );

    const target = targetResult.rows[0];

    if (!target) {
      const error = new Error("Project member not found");
      error.statusCode = 404;
      throw error;
    }

    // Project admins cannot remove other project admins.
    if (!isTeamManager && target.role === "admin") {
      const error = new Error(
        "A project admin cannot remove another project admin",
      );
      error.statusCode = 403;
      throw error;
    }

    // Never leave a project without an admin.
    if (target.role === "admin") {
      const countResult = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM project_members
         WHERE project_id = $1 AND role = 'admin'`,
        [projectId],
      );

      if (countResult.rows[0].total <= 1) {
        const error = new Error("Cannot remove the last project admin");
        error.statusCode = 409;
        throw error;
      }
    }

    const result = await client.query(
      `DELETE FROM project_members
       WHERE project_id = $1 AND user_id = $2
       RETURNING project_id, user_id, role`,
      [projectId, targetUserId],
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

export async function deleteProject({ teamId, projectId, userId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const projectResult = await client.query(
      `SELECT id
       FROM projects
       WHERE id = $1 AND team_id = $2
       FOR UPDATE`,
      [projectId, teamId],
    );

    if (!projectResult.rows[0]) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    const membershipResult = await client.query(
      `SELECT role
       FROM team_members
       WHERE team_id = $1 AND user_id = $2
       FOR UPDATE`,
      [teamId, userId],
    );

    const membership = membershipResult.rows[0];

    if (!membership) {
      const error = new Error("Team membership not found");
      error.statusCode = 404;
      throw error;
    }

    if (!["owner", "admin"].includes(membership.role)) {
      const error = new Error(
        "Only the team owner or admin can delete a project",
      );
      error.statusCode = 403;
      throw error;
    }

    const result = await client.query(
      `DELETE FROM projects
       WHERE id = $1 AND team_id = $2
       RETURNING id, team_id, name, slug`,
      [projectId, teamId],
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
