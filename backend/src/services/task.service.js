import {
  createTask,
  findTasksByProject,
  findTaskDetails,
  updateTask,
  assignTaskUser,
  unassignTaskUser,
} from "../repositories/task.repository.js";
import { deleteTask } from "../repositories/task.repository.js";
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

  return createTask({
    teamId,
    projectId,
    userId,
    ...taskData,
  });
}

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

  return updateTask({
    teamId,
    projectId,
    taskId,
    userId,
    updates,
  });
}
export async function assignTaskUserService(data) {
  return assignTaskUser(data);
}

export async function unassignTaskUserService(data) {
  return unassignTaskUser(data);
}

export async function deleteTaskService(data) {
  return deleteTask(data);
}
