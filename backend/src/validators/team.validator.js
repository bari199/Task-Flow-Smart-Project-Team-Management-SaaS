import { z } from "zod";

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters")
    .max(120, "Team name cannot exceed 120 characters"),
});

export const updateTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters")
    .max(120, "Team name cannot exceed 120 characters"),
});

export const createTeamInvitationSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "member"]).default("member"),
});

export const acceptTeamInvitationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const updateTeamMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});
