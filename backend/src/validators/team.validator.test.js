import { describe, it, expect } from "vitest";

import {
  createTeamSchema,
  updateTeamSchema,
  createTeamInvitationSchema,
  acceptTeamInvitationSchema,
  updateTeamMemberRoleSchema,
} from "./team.validator.js";

describe("Team validators", () => {
  it("accepts a valid team name", () => {
    expect(
      createTeamSchema.safeParse({ name: "Development Team" }).success,
    ).toBe(true);
  });

  it("rejects a team name that is too short", () => {
    expect(createTeamSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("accepts a valid team update", () => {
    expect(updateTeamSchema.safeParse({ name: "Updated Team" }).success).toBe(
      true,
    );
  });

  it("rejects an invalid invitation email", () => {
    expect(
      createTeamInvitationSchema.safeParse({
        email: "not-an-email",
        role: "member",
      }).success,
    ).toBe(false);
  });

  it("rejects inviting someone as owner", () => {
    expect(
      createTeamInvitationSchema.safeParse({
        email: "person@example.com",
        role: "owner",
      }).success,
    ).toBe(false);
  });

  it("accepts an admin invitation role", () => {
    expect(
      createTeamInvitationSchema.safeParse({
        email: "person@example.com",
        role: "admin",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed invitation token", () => {
    expect(
      acceptTeamInvitationSchema.safeParse({
        token: "short-token",
      }).success,
    ).toBe(false);
  });

  it("accepts a 64-character hexadecimal token", () => {
    expect(
      acceptTeamInvitationSchema.safeParse({
        token: "a".repeat(64),
      }).success,
    ).toBe(true);
  });

  it("accepts member role changes", () => {
    expect(
      updateTeamMemberRoleSchema.safeParse({
        role: "member",
      }).success,
    ).toBe(true);
  });

  it("rejects owner role changes", () => {
    expect(
      updateTeamMemberRoleSchema.safeParse({
        role: "owner",
      }).success,
    ).toBe(false);
  });
});
