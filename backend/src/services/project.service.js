import {
  createProject,
  deleteProject,
  updateProject,
} from "../repositories/project.repository.js";

import {
  findProjectsByTeam,
  findProjectDetails,
  addProjectMember,
  removeProjectMember,
} from "../repositories/project.repository.js";

import { getCache, setCache } from "../utils/cache.js";

import { projectListCacheKey } from "../utils/cache-keys.js";

// Pattern for your existing list-project service.
// Keep your actual repository and access-check function names.
export async function listProjectsWithCache({
  teamId,
  userId,
  page = 1,
  limit = 10,
  search = "",
}) {
  // 1. Always check access before reading cached data.
  // Call your existing team/project authorization logic here.
  await assertTeamMembership({ teamId, userId });

  // 2. Build a key for this user and query combination.
  const cacheKey = projectListCacheKey({
    teamId,
    userId,
    page,
    limit,
    search,
  });

  // 3. Return cache if available.
  const cached = await getCache(cacheKey);

  if (cached !== null) {
    return cached;
  }

  // 4. On cache miss, fetch using your existing repository.
  const result = await listProjectsFromDatabase({
    teamId,
    userId,
    page,
    limit,
    search,
  });

  // 5. Cache briefly, then return the result.
  await setCache(cacheKey, result, 60);

  return result;
}

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
export async function updateProjectService({
  teamId,
  projectId,
  userId,
  name,
  description,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return updateProject({
    teamId,
    projectId,
    userId,
    name,
    description,
  });
}
export async function deleteProjectService({ teamId, projectId, userId }) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return deleteProject({
    teamId,
    projectId,
    userId,
  });
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
