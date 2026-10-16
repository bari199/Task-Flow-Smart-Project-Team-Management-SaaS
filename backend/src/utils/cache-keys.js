// ========================================
// PROJECT LIST CACHE KEY
// ========================================

export const projectListCacheKey = ({
  teamId,
  userId,
  page = 1,
  limit = 10,
  search = "",
}) =>
  `task-flow:cache:projects:${teamId}:${userId}:${page}:${limit}:${encodeURIComponent(search)}`;

// ========================================
// TASK LIST CACHE KEY
// ========================================

export const taskListCacheKey = ({
  teamId,
  projectId,
  userId,
  page = 1,
  limit = 10,
  status = "",
  priority = "",
  search = "",
}) =>
  [
    "task-flow:cache:tasks",
    teamId,
    projectId,
    userId,
    page,
    limit,
    status || "all-statuses",
    priority || "all-priorities",
    encodeURIComponent(search),
  ].join(":");

// ========================================
// PROJECT CACHE INVALIDATION PATTERN
// ========================================

export const projectCachePattern = (teamId) =>
  `task-flow:cache:projects:${teamId}:*`;

// ========================================
// TASK CACHE INVALIDATION PATTERN
// ========================================

export const taskCachePattern = (teamId, projectId) =>
  `task-flow:cache:tasks:${teamId}:${projectId}:*`;
