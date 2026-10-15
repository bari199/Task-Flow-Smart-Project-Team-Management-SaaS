import { Router } from "express";
import { authenticate } from "../middleware/authenticate.middleware.js";
import {
  createProjectController,
  listProjectsController,
  getProjectDetailsController,
  updateProjectController,
  addProjectMemberController,
  removeProjectMemberController,
  deleteProjectController,
} from "../controllers/project.controller.js";

const router = Router();

router.post("/teams/:teamId/projects", authenticate, createProjectController);
router.get("/teams/:teamId/projects", authenticate, listProjectsController);
router.get(
  "/teams/:teamId/projects/:projectId",
  authenticate,
  getProjectDetailsController,
);
router.patch(
  "/teams/:teamId/projects/:projectId",
  authenticate,
  updateProjectController,
);

router.post(
  "/teams/:teamId/projects/:projectId/members",
  authenticate,
  addProjectMemberController,
);

router.delete(
  "/teams/:teamId/projects/:projectId/members/:userId",
  authenticate,
  removeProjectMemberController,
);

router.delete(
  "/teams/:teamId/projects/:projectId",
  authenticate,
  deleteProjectController,
);

export default router;
