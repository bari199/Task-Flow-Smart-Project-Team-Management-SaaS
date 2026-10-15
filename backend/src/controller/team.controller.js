import {
  createTeamSchema,
  createTeamInvitationSchema,
  acceptTeamInvitationSchema,
  updateTeamMemberRoleSchema,
  updateTeamMemberRoleService,
} from "../validators/team.validator.js";

import {
  createTeamService,
  getMyTeamsService,
  getTeamDetailsService,
  updateTeamService,
  acceptTeamInvitationService,
  createTeamInvitationService,
  removeTeamMemberService,
} from "../services/team.service.js";
import { updateTaskSchema } from "../validators/task.validator.js";
import { updateTaskService } from "../services/task.service.js";

export async function createTeamController(req, res, next) {
  try {
    const validation = createTeamSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Prefer the authenticated session's user ID.
    const ownerId = req.session?.userId ?? req.user?.id;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const team = await createTeamService({
      name: validation.data.name,
      ownerId,
    });

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function createTeamInvitationController(req, res, next) {
  try {
    const validation = createTeamInvitationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const invitation = await createTeamInvitationService({
      teamId: req.params.teamId,
      userId,
      ...validation.data,
    });

    return res.status(201).json({
      success: true,
      message: "Team invitation created",
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
}

export async function findTeamsByUserId(userId) {
  const result = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.slug,
       t.created_at,
       tm.role
     FROM team_members AS tm
     INNER JOIN teams AS t
       ON t.id = tm.team_id
     WHERE tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function getMyTeamsController(req, res, next) {
  try {
    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const teams = await getMyTeamsService(userId);

    return res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamDetailsController(req, res, next) {
  try {
    const userId = req.session?.userId ?? req.user?.id;
    const { teamId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const team = await getTeamDetailsService({ teamId, userId });

    return res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTeamController(req, res, next) {
  try {
    const validation = updateTeamSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const team = await updateTeamService({
      teamId: req.params.teamId,
      userId,
      name: validation.data.name,
    });

    return res.status(200).json({
      success: true,
      message: "Team updated successfully",
      data: team,
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptTeamInvitationController(req, res, next) {
  try {
    const validation = acceptTeamInvitationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation token format",
      });
    }

    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const data = await acceptTeamInvitationService({
      userId,
      token: validation.data.token,
    });

    return res.status(200).json({
      success: true,
      message: "Team invitation accepted",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTeamMemberRoleController(req, res, next) {
  try {
    const validation = updateTeamMemberRoleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const actorId = req.session?.userId ?? req.user?.id;

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const member = await updateTeamMemberRoleService({
      teamId: req.params.teamId,
      actorId,
      targetUserId: req.params.userId,
      role: validation.data.role,
    });

    return res.status(200).json({
      success: true,
      message: "Team member role updated",
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeTeamMemberController(req, res, next) {
  try {
    const actorId = req.session?.userId ?? req.user?.id;

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { teamId, userId: targetUserId } = req.params;

    const removedMember = await removeTeamMemberService({
      teamId,
      actorId,
      targetUserId,
    });

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
      data: removedMember,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskController(req, res, next) {
  try {
    const validation = updateTaskSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const task = await updateTaskService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      taskId: req.params.taskId,
      userId,
      updates: validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    next(error);
  }
}
