import { Router } from "express";
import { authenticate } from "../middleware/authenticate.middleware.js";

import {
  createTaskCommentController,
  listTaskCommentsController,
  updateTaskCommentController,
  deleteTaskCommentController,
} from "../controllers/task-comment.controller.js";

const router = Router();

router.post(
  "/teams/:teamId/projects/:projectId/tasks/:taskId/comments",
  authenticate,
  createTaskCommentController,
);

router.get(
  "/teams/:teamId/projects/:projectId/tasks/:taskId/comments",
  authenticate,
  listTaskCommentsController,
);

router.patch(
  "/teams/:teamId/projects/:projectId/tasks/:taskId/comments/:commentId",
  authenticate,
  updateTaskCommentController,
);

router.delete(
  "/teams/:teamId/projects/:projectId/tasks/:taskId/comments/:commentId",
  authenticate,
  deleteTaskCommentController,
);

export default router;
