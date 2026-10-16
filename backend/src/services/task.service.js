import {
  createTask,
  findTasksByProject,
  findTaskDetails,
  updateTask,
  assignTaskUser,
  unassignTaskUser,
} from "../repositories/task.repository.js";

import { deleteTask } from "../repositories/task.repository.js";

import { deleteCacheByPattern } from "../utils/cache.js";

import { taskCachePattern, projectCachePattern } from "../utils/cache-keys.js";

import crypto from "node:crypto";

import { enqueueNotificationJob } from "../queues/notification.queue.js";

export async function assignTaskUserService(data) {
  const assignment = await assignTaskUser(data);

  if (data.actorId !== data.userId) {
    try {
      await enqueueNotificationJob({
        eventId: crypto.randomUUID(),
        type: "task_assigned",
        recipientUserId: data.userId,
        actorUserId: data.actorId,
        teamId: data.teamId,
        projectId: data.projectId,
        taskId: data.taskId,
      });
    } catch (error) {
      console.error("Notification enqueue failed:", error.message);
    }
  }

  return assignment;
}

// Cache invalidation helper
async function invalidateTaskCache(teamId, projectId) {
  try {
    if (teamId && projectId) {
      await deleteCacheByPattern(taskCachePattern(teamId, projectId));
    }

    if (teamId) {
      await deleteCacheByPattern(projectCachePattern(teamId));
    }
  } catch (error) {
    console.error("Task cache invalidation failed:", error);
  }
}

// CREATE TASK
export async function createTaskService({
  teamId,
  projectId,
  userId,
  ...taskData
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const task = await createTask({
    teamId,
    projectId,
    userId,
    ...taskData,
  });

  // Invalidate cache after successful creation
  await invalidateTaskCache(teamId, projectId);

  return task;
}

// LIST TASKS
export async function listTasksService({
  teamId,
  projectId,
  userId,
  page,
  limit,
  status,
  priority,
  search,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const result = await findTasksByProject({
    teamId,
    projectId,
    userId,
    page,
    limit,
    status,
    priority,
    search,
  });

  if (!result) {
    const error = new Error("Project not found or you do not have access");
    error.statusCode = 404;
    throw error;
  }

  return result;
}

// GET TASK DETAILS
export async function getTaskDetailsService({
  teamId,
  projectId,
  taskId,
  userId,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const task = await findTaskDetails({
    teamId,
    projectId,
    taskId,
    userId,
  });

  if (!task) {
    const error = new Error("Task not found or you do not have access");
    error.statusCode = 404;
    throw error;
  }

  return task;
}

// UPDATE TASK
export async function updateTaskService({
  teamId,
  projectId,
  taskId,
  userId,
  updates,
}) {
  if (!userId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const updatedTask = await updateTask({
    teamId,
    projectId,
    taskId,
    userId,
    updates,
  });

  // Invalidate cache after successful update
  if (updatedTask) {
    await invalidateTaskCache(teamId, projectId);
  }

  return updatedTask;
}

// UNASSIGN TASK USER
export async function unassignTaskUserService(data) {
  const result = await unassignTaskUser(data);

  // Invalidate cache after successful unassignment
  if (result) {
    await invalidateTaskCache(data.teamId, data.projectId);
  }

  return result;
}

// DELETE TASK
export async function deleteTaskService(data) {
  const result = await deleteTask(data);

  // Invalidate cache after successful deletion
  if (result) {
    await invalidateTaskCache(data.teamId, data.projectId);
  }

  return result;
}
