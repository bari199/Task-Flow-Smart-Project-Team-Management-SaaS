import { Router } from "express";
import { authenticate } from "../middleware/authenticate.middleware.js";
import {
  createTaskController,
  listTasksController,
  getTaskDetailsController,
  updateTaskController,
  deleteTaskController,
  unassignTaskUserController,
  assignTaskUserController,
} from "../controllers/task.controller.js";

const router = Router();

router.post(
  "/teams/:teamId/projects/:projectId/tasks",
  authenticate,
  createTaskController,
);

router.post(
  "/teams/:teamId/projects/:projectId/tasks/:taskId/assignees",
  authenticate,
  assignTaskUserController,
);

router.delete(
  "/teams/:teamId/projects/:projectId/tasks/:taskId/assignees/:userId",
  authenticate,
  unassignTaskUserController,
);

router.get(
  "/teams/:teamId/projects/:projectId/tasks",
  authenticate,
  listTasksController,
);

router.get(
  "/teams/:teamId/projects/:projectId/tasks/:taskId",
  authenticate,
  getTaskDetailsController,
);

router.patch(
  "/teams/:teamId/projects/:projectId/tasks/:taskId",
  authenticate,
  updateTaskController,
);

router.delete(
  "/teams/:teamId/projects/:projectId/tasks/:taskId",
  authenticate,
  deleteTaskController,
);

export default router;
