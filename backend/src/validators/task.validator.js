import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().default(""),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: z.string().date().optional().nullable().default(null),
});

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  search: z.string().trim().max(120).optional().default(""),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().date().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const assignTaskUserSchema = z
  .object({
    userId: z.string().uuid("Valid userId is required"),
  })
  .strict();

export const unassignTaskUserParamsSchema = z
  .object({
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    userId: z.string().uuid(),
  })
  .strict();

export const createTaskCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

export const updateTaskCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

export const taskCommentParamsSchema = z
  .object({
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
  })
  .strict();

export const taskCommentIdParamsSchema = taskCommentParamsSchema.extend({
  commentId: z.string().uuid(),
});

export const taskCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
