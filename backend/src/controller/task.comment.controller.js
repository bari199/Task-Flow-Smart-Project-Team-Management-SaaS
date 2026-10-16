import {
  createTaskCommentService,
  listTaskCommentsService,
  updateTaskCommentService,
  deleteTaskCommentService,
} from "../services/task.comment.service.js";

import {
  createTaskCommentSchema,
  updateTaskCommentSchema,
  taskCommentParamsSchema,
  taskCommentIdParamsSchema,
  taskCommentsQuerySchema,
} from "../validators/task.validator.js";

function getActorId(req) {
  return req.session?.userId ?? req.user?.id;
}

function requireActorId(req) {
  const actorId = getActorId(req);

  if (!actorId) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  return actorId;
}

export async function createTaskCommentController(req, res, next) {
  try {
    const params = taskCommentParamsSchema.parse(req.params);
    const { content } = createTaskCommentSchema.parse(req.body);
    const userId = requireActorId(req);

    const comment = await createTaskCommentService({
      ...params,
      userId,
      content,
    });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTaskCommentsController(req, res, next) {
  try {
    const params = taskCommentParamsSchema.parse(req.params);
    const query = taskCommentsQuerySchema.parse(req.query);
    const userId = requireActorId(req);

    const result = await listTaskCommentsService({
      ...params,
      userId,
      ...query,
    });

    return res.status(200).json({
      success: true,
      data: result.comments,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskCommentController(req, res, next) {
  try {
    const params = taskCommentIdParamsSchema.parse(req.params);
    const { content } = updateTaskCommentSchema.parse(req.body);
    const userId = requireActorId(req);

    const comment = await updateTaskCommentService({
      ...params,
      userId,
      content,
    });

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskCommentController(req, res, next) {
  try {
    const params = taskCommentIdParamsSchema.parse(req.params);
    const userId = requireActorId(req);

    const comment = await deleteTaskCommentService({
      ...params,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}
