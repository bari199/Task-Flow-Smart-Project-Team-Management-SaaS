import {
  createTeam,
  findTeamsByUserId,
  findTeamByIdForUser,
  updateTeamForAdmin,
} from "../repositories/team.repository.js";
import { acceptTeamInvitation } from "../repositories/team.repository.js";
import { createHash, randomBytes } from "node:crypto";
import { createInvitation } from "../repositories/team.repository.js";
import { updateTeamMemberRole } from "../repositories/team.repository.js";
import { removeTeamMember } from "../repositories/team.repository.js";

export async function createTeamService({ name, ownerId }) {
  if (!ownerId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return createTeam({ name, ownerId });
}

export async function createTeamInvitationService({
  teamId,
  userId,
  email,
  role,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const invitation = await createInvitation({
    teamId,
    invitedBy: userId,
    email,
    role,
    tokenHash,
    expiresAt,
  });

  if (!invitation) {
    const error = new Error(
      "Team not found, insufficient permissions, or user is already a member",
    );
    error.statusCode = 404;
    throw error;
  }

  const frontendUrl = process.env.FRONTEND_URL;
  const inviteUrl = `${frontendUrl}/invitations/accept?token=${token}`;

  if (process.env.NODE_ENV === "development") {
    console.log("Team invitation link:", inviteUrl);
  } else {
    // Do not silently claim an invitation email was sent.
    // Integrate the existing email provider before production use.
    throw new Error("Invitation email delivery is not configured");
  }

  return {
    id: invitation.id,
    teamId: invitation.team_id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expires_at,
  };
}

export async function getMyTeamsService(userId) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return findTeamsByUserId(userId);
}

export async function getTeamDetailsService({ teamId, userId }) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const team = await findTeamByIdForUser(teamId, userId);

  if (!team) {
    // Same response for missing team and unauthorized membership.
    const error = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  return team;
}

export async function updateTeamService({ teamId, userId, name }) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const team = await updateTeamForAdmin({
    teamId,
    userId,
    name,
  });

  if (!team) {
    const error = new Error("Team not found or insufficient permissions");
    error.statusCode = 404;
    throw error;
  }

  return team;
}

export async function acceptTeamInvitationService({ userId, token }) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  return acceptTeamInvitation({
    userId,
    tokenHash,
  });
}

export async function updateTeamMemberRoleService({
  teamId,
  actorId,
  targetUserId,
  role,
}) {
  if (!actorId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return updateTeamMemberRole({
    teamId,
    actorId,
    targetUserId,
    newRole: role,
  });
}

export async function removeTeamMemberService({
  teamId,
  actorId,
  targetUserId,
}) {
  if (!actorId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  if (actorId === targetUserId) {
    const error = new Error("Use the leave-team flow to leave a team");
    error.statusCode = 400;
    throw error;
  }

  return removeTeamMember({
    teamId,
    actorId,
    targetUserId,
  });
}
