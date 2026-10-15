import {
  createTaskComment,
  listTaskComments,
  updateTaskComment,
  deleteTaskComment,
} from "../repositories/task-comment.repository.js";

export const createTaskCommentService = (data) => createTaskComment(data);

export const listTaskCommentsService = (data) => listTaskComments(data);

export const updateTaskCommentService = (data) => updateTaskComment(data);

export const deleteTaskCommentService = (data) => deleteTaskComment(data);
