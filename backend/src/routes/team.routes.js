import { Router } from "express";
import { createTeamController } from "../controller/team.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { getMyTeamsController } from "../controller/team.controller.js";
import { getTeamDetailsController } from "../controller/team.controller.js";
import { updateTeamController } from "../controller/team.controller.js";
import { createTeamInvitationController } from "../controllers/team.controller.js";
import { acceptTeamInvitationController } from "../controllers/team.controller.js";
import { updateTeamMemberRoleController } from "../controllers/team.controller.js";
import { removeTeamMemberController } from "../controllers/team.controller.js";

const router = Router();

router.post("/", authenticate, createTeamController);
router.get("/", authenticate, getMyTeamsController);
router.get("/:teamId", authenticate, getTeamDetailsController);
router.put("/:teamId", authenticate, updateTeamController);
router.patch("/:teamId", authenticate, updateTeamController);
router.post(
  "/:teamId/invitations",
  authenticate,
  createTeamInvitationController,
);

router.post(
  "/invitations/accept",
  authenticate,
  acceptTeamInvitationController,
);

router.patch(
  "/:teamId/members/:userId/role",
  authenticate,
  updateTeamMemberRoleController,
);

router.delete(
  "/:teamId/members/:userId",
  authenticate,
  removeTeamMemberController,
);

export default router;
