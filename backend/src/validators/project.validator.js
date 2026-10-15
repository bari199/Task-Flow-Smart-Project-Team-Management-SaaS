import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().default(""),
});

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional().default(""),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field is required",
  });

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member"]).default("member"),
});
