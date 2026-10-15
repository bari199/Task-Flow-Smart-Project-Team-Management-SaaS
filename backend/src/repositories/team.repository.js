import { randomBytes } from "node:crypto";
import { pool } from "../config/database.js";
function slugify(value) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "team"
  );
}

export async function createTeam({ name, ownerId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const baseSlug = slugify(name);
    let team = null;

    // ON CONFLICT prevents duplicate slugs from aborting the transaction.
    for (let attempt = 0; attempt < 5 && !team; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${randomBytes(3).toString("hex")}`;

      const slug = `${baseSlug.slice(0, 140 - suffix.length)}${suffix}`;

      const result = await client.query(
        `INSERT INTO teams (name, slug, owner_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id, name, slug, owner_id, created_at, updated_at`,
        [name, slug, ownerId],
      );

      team = result.rows[0] ?? null;
    }

    if (!team) {
      const error = new Error("Could not generate a unique team slug");
      error.statusCode = 409;
      throw error;
    }

    await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [team.id, ownerId],
    );

    await client.query("COMMIT");

    return { ...team, role: "owner" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createInvitation({
  teamId,
  invitedBy,
  email,
  role,
  tokenHash,
  expiresAt,
}) {
  const result = await pool.query(
    `INSERT INTO team_invitations (
       team_id,
       invited_by,
       email,
       role,
       token_hash,
       expires_at
     )
     SELECT
       t.id, $2, LOWER($3), $4, $5, $6
     FROM teams AS t
     JOIN team_members AS tm
       ON tm.team_id = t.id
     WHERE t.id = $1
       AND tm.user_id = $2
       AND tm.role IN ('owner', 'admin')
       AND NOT EXISTS (
         SELECT 1
         FROM team_members AS existing_member
         JOIN users AS existing_user
           ON existing_user.id = existing_member.user_id
         WHERE existing_member.team_id = t.id
           AND LOWER(existing_user.email) = LOWER($3)
       )
     RETURNING
       id, team_id, email, role, expires_at, created_at`,
    [teamId, invitedBy, email, role, tokenHash, expiresAt],
  );

  return result.rows[0] ?? null;
}

export async function findTeamsByUserId(userId) {
  const result = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.slug,
       t.created_at,
       tm.role
     FROM team_members AS tm
     INNER JOIN teams AS t
       ON t.id = tm.team_id
     WHERE tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function findTeamByIdForUser(teamId, userId) {
  const result = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.slug,
       t.owner_id,
       t.created_at,
       t.updated_at,
       tm.role
     FROM teams AS t
     INNER JOIN team_members AS tm
       ON tm.team_id = t.id
     WHERE t.id = $1
       AND tm.user_id = $2
     LIMIT 1`,
    [teamId, userId],
  );

  return result.rows[0] ?? null;
}

export async function updateTeamForAdmin({ teamId, userId, name }) {
  const result = await pool.query(
    `UPDATE teams AS t
     SET name = $3,
         updated_at = NOW()
     FROM team_members AS tm
     WHERE t.id = $1
       AND tm.team_id = t.id
       AND tm.user_id = $2
       AND tm.role IN ('owner', 'admin')
     RETURNING
       t.id,
       t.name,
       t.slug,
       t.owner_id,
       t.created_at,
       t.updated_at,
       tm.role`,
    [teamId, userId, name],
  );

  return result.rows[0] ?? null;
}

export async function acceptTeamInvitation({ userId, tokenHash }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the invitation so it cannot be accepted twice.
    const invitationResult = await client.query(
      `SELECT
         id, team_id, email, role, expires_at, accepted_at
       FROM team_invitations
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash],
    );

    const invitation = invitationResult.rows[0];

    if (!invitation) {
      const error = new Error("Invalid invitation");
      error.statusCode = 404;
      throw error;
    }

    if (invitation.accepted_at) {
      const error = new Error("Invitation has already been used");
      error.statusCode = 409;
      throw error;
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      const error = new Error("Invitation has expired");
      error.statusCode = 410;
      throw error;
    }

    // The signed-in account must match the invited email.
    const userResult = await client.query(
      `SELECT email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    const user = userResult.rows[0];

    if (
      !user?.email ||
      user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()
    ) {
      const error = new Error(
        "Sign in with the email address that received the invitation",
      );
      error.statusCode = 403;
      throw error;
    }

    // Add the user with the role stored in the invitation.
    const membershipResult = await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO NOTHING
       RETURNING team_id, user_id, role`,
      [invitation.team_id, userId, invitation.role],
    );

    if (!membershipResult.rows[0]) {
      const error = new Error("User is already a team member");
      error.statusCode = 409;
      throw error;
    }

    await client.query(
      `UPDATE team_invitations
       SET accepted_at = NOW()
       WHERE id = $1`,
      [invitation.id],
    );

    await client.query("COMMIT");

    return {
      teamId: invitation.team_id,
      role: membershipResult.rows[0].role,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTeamMemberRole({
  teamId,
  actorId,
  targetUserId,
  newRole,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const actorResult = await client.query(
      `SELECT role
       FROM team_members
       WHERE team_id = $1 AND user_id = $2
       FOR UPDATE`,
      [teamId, actorId],
    );

    const targetResult = await client.query(
      `SELECT role
       FROM team_members
       WHERE team_id = $1 AND user_id = $2
       FOR UPDATE`,
      [teamId, targetUserId],
    );

    const actor = actorResult.rows[0];
    const target = targetResult.rows[0];

    if (!actor || !target) {
      const error = new Error("Team member or team not found");
      error.statusCode = 404;
      throw error;
    }

    if (target.role === "owner") {
      const error = new Error("The team owner's role cannot be changed here");
      error.statusCode = 403;
      throw error;
    }

    if (!["owner", "admin"].includes(actor.role)) {
      const error = new Error("Only an owner or admin can manage member roles");
      error.statusCode = 403;
      throw error;
    }

    // Admins may demote an admin to member, but only an
    // owner may grant the admin role.
    if (actor.role === "admin" && newRole === "admin") {
      const error = new Error("Only the team owner can grant the admin role");
      error.statusCode = 403;
      throw error;
    }

    const result = await client.query(
      `UPDATE team_members
       SET role = $3
       WHERE team_id = $1 AND user_id = $2
       RETURNING team_id, user_id, role`,
      [teamId, targetUserId, newRole],
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

export async function removeTeamMember({ teamId, actorId, targetUserId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the actor's membership.
    const actorResult = await client.query(
      `SELECT role
       FROM team_members
       WHERE team_id = $1 AND user_id = $2
       FOR UPDATE`,
      [teamId, actorId],
    );

    const actor = actorResult.rows[0];

    if (!actor) {
      const error = new Error("Team or membership not found");
      error.statusCode = 404;
      throw error;
    }

    if (!["owner", "admin"].includes(actor.role)) {
      const error = new Error("Insufficient permissions");
      error.statusCode = 403;
      throw error;
    }

    // Lock the target membership.
    const targetResult = await client.query(
      `SELECT role
       FROM team_members
       WHERE team_id = $1 AND user_id = $2
       FOR UPDATE`,
      [teamId, targetUserId],
    );

    const target = targetResult.rows[0];

    if (!target) {
      const error = new Error("Team member not found");
      error.statusCode = 404;
      throw error;
    }

    if (target.role === "owner") {
      const error = new Error("The team owner cannot be removed");
      error.statusCode = 403;
      throw error;
    }

    if (actor.role === "admin" && target.role !== "member") {
      const error = new Error(
        "Admins can remove members but cannot remove other admins",
      );
      error.statusCode = 403;
      throw error;
    }

    // Remove project memberships within this team's projects.
    await client.query(
      `DELETE FROM project_members AS pm
       USING projects AS p
       WHERE pm.project_id = p.id
         AND p.team_id = $1
         AND pm.user_id = $2`,
      [teamId, targetUserId],
    );

    // Remove task assignments within this team's projects.
    await client.query(
      `DELETE FROM task_assignees AS ta
       USING tasks AS t, projects AS p
       WHERE ta.task_id = t.id
         AND t.project_id = p.id
         AND p.team_id = $1
         AND ta.user_id = $2`,
      [teamId, targetUserId],
    );

    const result = await client.query(
      `DELETE FROM team_members
       WHERE team_id = $1 AND user_id = $2
       RETURNING team_id, user_id, role`,
      [teamId, targetUserId],
    );

    if (!result.rows[0]) {
      const error = new Error("Team member not found");
      error.statusCode = 404;
      throw error;
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTask({
  teamId,
  projectId,
  taskId,
  userId,
  updates,
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
       WHERE p.team_id = $1
         AND p.id = $2
         AND t.id = $3
       FOR UPDATE OF t`,
      [teamId, projectId, taskId, userId],
    );

    if (!taskResult.rows[0]) {
      const error = new Error("Task not found or you do not have access");
      error.statusCode = 404;
      throw error;
    }

    const allowedColumns = {
      title: "title",
      description: "description",
      status: "status",
      priority: "priority",
      dueDate: "due_date",
    };

    const fields = Object.entries(updates).filter(([key]) =>
      Object.hasOwn(allowedColumns, key),
    );

    if (fields.length === 0) {
      const error = new Error("No valid fields provided");
      error.statusCode = 400;
      throw error;
    }

    const values = [taskId, projectId];
    const assignments = fields.map(([key, value]) => {
      values.push(value);
      return `${allowedColumns[key]} = $${values.length}`;
    });

    assignments.push("updated_at = NOW()");

    const result = await client.query(
      `UPDATE tasks
       SET ${assignments.join(", ")}
       WHERE id = $1 AND project_id = $2
       RETURNING *`,
      values,
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
