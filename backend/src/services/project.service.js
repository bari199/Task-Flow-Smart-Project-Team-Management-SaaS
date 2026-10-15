import { createProject } from "../repositories/project.repository.js";
import {
  findProjectsByTeam,
  findProjectDetails,
  addProjectMember,
  removeProjectMember,
} from "../repositories/project.repository.js";

export async function createProjectService({
  teamId,
  userId,
  name,
  description,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return createProject({
    teamId,
    userId,
    name,
    description,
  });
}

export async function listProjectsService({
  teamId,
  userId,
  page,
  limit,
  search,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const result = await findProjectsByTeam({
    teamId,
    userId,
    page,
    limit,
    search,
  });

  if (!result) {
    const error = new Error("Team not found or you are not a team member");
    error.statusCode = 404;
    throw error;
  }

  return result;
}

export async function getProjectDetailsService({ teamId, projectId, userId }) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const project = await findProjectDetails({
    teamId,
    projectId,
    userId,
  });

  if (!project) {
    const error = new Error(
      "Project not found or you are not a member of its team",
    );
    error.statusCode = 404;
    throw error;
  }

  return project;
}

export async function addProjectMemberService({
  teamId,
  projectId,
  actorId,
  userId,
  role,
}) {
  if (!actorId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return addProjectMember({
    teamId,
    projectId,
    actorId,
    targetUserId: userId,
    role,
  });
}

export async function removeProjectMemberService({
  teamId,
  projectId,
  actorId,
  userId,
}) {
  if (!actorId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return removeProjectMember({
    teamId,
    projectId,
    actorId,
    targetUserId: userId,
  });
}
