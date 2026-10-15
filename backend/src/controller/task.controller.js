import {
  createTaskSchema,
  listTasksQuerySchema,
  assignTaskUserSchema,
  unassignTaskUserParamsSchema,
} from "../validators/task.validator.js";

import {
  createTaskService,
  assignTaskUserService,
  unassignTaskUserService,
  listTasksService,
  getTaskDetailsService,
  deleteTaskService,
} from "../services/task.service.js";
export async function createTaskController(req, res, next) {
  try {
    const validation = createTaskSchema.safeParse(req.body);

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

    const task = await createTaskService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      userId,
      ...validation.data,
    });

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTasksController(req, res, next) {
  try {
    const validation = listTasksQuerySchema.safeParse(req.query);

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

    const result = await listTasksService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      userId,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Tasks retrieved successfully",
      data: result.tasks,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTaskDetailsController(req, res, next) {
  try {
    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const task = await getTaskDetailsService({
      teamId: req.params.teamId,
      projectId: req.params.projectId,
      taskId: req.params.taskId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Task details retrieved successfully",
      data: task,
    });
  } catch (error) {
    next(error);
  }
}

export async function assignTaskUserController(req, res, next) {
  try {
    const { teamId, projectId, taskId } = req.params;
    const { userId } = assignTaskUserSchema.parse(req.body);

    const actorId = req.session?.userId ?? req.user?.id;

    if (!actorId) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      throw error;
    }

    const assignment = await assignTaskUserService({
      teamId,
      projectId,
      taskId,
      userId,
      actorId,
    });

    return res.status(201).json({
      success: true,
      message: "User assigned to task successfully",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function unassignTaskUserController(req, res, next) {
  try {
    const params = unassignTaskUserParamsSchema.parse(req.params);
    const actorId = req.session?.userId ?? req.user?.id;

    if (!actorId) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      throw error;
    }

    const assignment = await unassignTaskUserService({
      ...params,
      actorId,
    });

    return res.status(200).json({
      success: true,
      message: "User removed from task successfully",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskController(req, res, next) {
  try {
    const { teamId, projectId, taskId } = req.params;
    const userId = req.session?.userId ?? req.user?.id;

    if (!userId) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      throw error;
    }

    const deletedTask = await deleteTaskService({
      teamId,
      projectId,
      taskId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      data: deletedTask,
    });
  } catch (error) {
    next(error);
  }
}
