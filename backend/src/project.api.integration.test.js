import dotenv from "dotenv";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

dotenv.config({ path: ".env.test" });

const API_URL = process.env.TEST_API_URL || "http://127.0.0.1:8000";

const OWNER_COOKIE = process.env.TEST_OWNER_COOKIE;
const MEMBER_COOKIE = process.env.TEST_MEMBER_COOKIE;
const TEAM_ID = process.env.TEST_TEAM_ID;
const MEMBER_USER_ID = process.env.TEST_MEMBER_USER_ID;

const configured = Boolean(
  OWNER_COOKIE && MEMBER_COOKIE && TEAM_ID && MEMBER_USER_ID,
);

const api = request(API_URL);

let projectId;
const projectName = `Integration Test ${Date.now()}`;

describe.skipIf(!configured)("Project API integration", () => {
  beforeAll(async () => {
    // Ensure the API is running before starting the tests.
    const response = await api.get("/api/v1/teams");

    // Authentication or route-specific responses are acceptable here;
    // a connection failure will fail the test before this assertion.
    expect([200, 401, 404]).toContain(response.status);
  });

  afterAll(async () => {
    // Best-effort cleanup if an earlier test fails.
    if (projectId) {
      await api
        .delete(`/api/v1/teams/${TEAM_ID}/projects/${projectId}`)
        .set("Cookie", OWNER_COOKIE);
    }
  });

  it("creates a project as the team owner", async () => {
    const response = await api
      .post(`/api/v1/teams/${TEAM_ID}/projects`)
      .set("Cookie", OWNER_COOKIE)
      .send({
        name: projectName,
        description: "Created by automated integration tests",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(projectName);

    projectId = response.body.data.id;
    expect(projectId).toBeTruthy();
  });

  it("lists projects for a team member", async () => {
    const response = await api
      .get(`/api/v1/teams/${TEAM_ID}/projects?page=1&limit=10`)
      .set("Cookie", MEMBER_COOKIE);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toBeDefined();
    expect(response.body.data.some((project) => project.id === projectId)).toBe(
      true,
    );
  });

  it("retrieves the project details", async () => {
    const response = await api
      .get(`/api/v1/teams/${TEAM_ID}/projects/${projectId}`)
      .set("Cookie", OWNER_COOKIE);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(projectId);
    expect(response.body.data.name).toBe(projectName);
    expect(Array.isArray(response.body.data.members)).toBe(true);
  });

  it("updates the project as its owner", async () => {
    const response = await api
      .patch(`/api/v1/teams/${TEAM_ID}/projects/${projectId}`)
      .set("Cookie", OWNER_COOKIE)
      .send({
        description: "Updated by integration test",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.description).toBe("Updated by integration test");
  });

  it("denies a regular team member permission to update", async () => {
    const response = await api
      .patch(`/api/v1/teams/${TEAM_ID}/projects/${projectId}`)
      .set("Cookie", MEMBER_COOKIE)
      .send({
        name: "Unauthorized Update",
      });

    expect(response.status).toBe(403);
  });

  it("adds a team member to the project", async () => {
    const response = await api
      .post(`/api/v1/teams/${TEAM_ID}/projects/${projectId}/members`)
      .set("Cookie", OWNER_COOKIE)
      .send({
        userId: MEMBER_USER_ID,
        role: "member",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user_id).toBe(MEMBER_USER_ID);
    expect(response.body.data.role).toBe("member");
  });

  it("removes the project member", async () => {
    const response = await api
      .delete(
        `/api/v1/teams/${TEAM_ID}/projects/${projectId}/members/${MEMBER_USER_ID}`,
      )
      .set("Cookie", OWNER_COOKIE);

    expect(response.status).toBe(200);
    expect(response.body.data.user_id).toBe(MEMBER_USER_ID);
  });

  it("deletes the project as the team owner", async () => {
    const response = await api
      .delete(`/api/v1/teams/${TEAM_ID}/projects/${projectId}`)
      .set("Cookie", OWNER_COOKIE);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    projectId = undefined;
  });
});
