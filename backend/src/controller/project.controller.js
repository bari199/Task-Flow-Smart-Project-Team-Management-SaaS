import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from "../validators/project.validator.js";
import {
  createProjectService,
  listProjectsService,
  getProjectDetailsService,
  updateProjectService,
  addProjectMemberService,
  removeProjectMemberService,
  deleteProjectService,
} from "../services/project.service.js";

export async function createProjectController(req, res, next) {
  try {
    const validation = createProjectSchema.safeParse(req.body);

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

    const project = await createProjectService({
      teamId: req.params.teamId,
      userId,
      ...validation.data,
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

export async function listProjectsController(req, res, next) {
  try {
    const validation = listProjectsQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
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

    const result = await listProjectsService({
      teamId: req.params.teamId,
      userId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Projects retrieved successfully",
      data: result.projects,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProjectDetailsController(req, res, next) {
  try {
    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const project = await getProjectDetailsService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Project details retrieved successfully",
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProjectController(req, res, next) {
  try {
    const validation = updateProjectSchema.safeParse(req.body);

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

    const project = await updateProjectService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      userId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

export async function addProjectMemberController(req, res, next) {
  try {
    const validation = addProjectMemberSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid project member data",
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

    const member = await addProjectMemberService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      actorId,
      ...validation.data,
    });

    return res.status(201).json({
      success: true,
      message: "Project member added successfully",
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeProjectMemberController(req, res, next) {
  try {
    const actorId = req.session?.userId ?? req.user?.id;

    if (!actorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const member = await removeProjectMemberService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      actorId,
      userId: req.params.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Project member removed successfully",
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProjectController(req, res, next) {
  try {
    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const project = await deleteProjectService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      data: project,
    });
  } catch (error) {
    next(error);
  }
}
