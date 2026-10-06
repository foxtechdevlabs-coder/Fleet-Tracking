// HTTP integration tests for the health and API discovery endpoints.
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("health and API discovery", () => {
  const app = createApp();

  it("responds on the versioned API health endpoint", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("preserves the legacy health endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("serves an OpenAPI document containing the versioned health route", async () => {
    const response = await request(app).get("/api-docs.json");

    expect(response.status).toBe(200);
    expect(
      response.body.paths["/api/v1/health"].get.responses["200"],
    ).toBeDefined();
    expect(response.body.paths["/health"].get.deprecated).toBe(true);
  });

  it("allows the configured local frontend origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("does not grant CORS access to an unconfigured origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://untrusted.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("requires admin authentication for domain and account routes", async () => {
    for (const path of [
      "/api/v1/auth/me",
      "/api/v1/auth/logout",
      "/api/v1/vehicles",
      "/api/v1/devices",
      "/api/v1/setup/vehicle-device",
    ]) {
      const response =
        path.endsWith("/logout") || path.endsWith("/vehicle-device")
          ? await request(app).post(path)
          : await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        code: "UNAUTHENTICATED",
      });
    }

    const vehicles = await request(app).get("/api/vehicles");
    expect(vehicles.status).toBe(401);
    expect(vehicles.body.success).toBe(false);
  });

  it("publishes the authentication and vehicle/device routes in OpenAPI", async () => {
    const response = await request(app).get("/api-docs.json");

    expect(response.body.paths["/api/v1/auth/login"].post).toBeDefined();
    expect(response.body.paths["/api/vehicles"].get).toBeDefined();
    expect(response.body.paths["/api/vehicles/{id}"].put).toBeDefined();
    expect(response.body.paths["/api/v1/devices"].post).toBeDefined();
    expect(
      response.body.paths["/api/v1/setup/vehicle-device"].post,
    ).toBeDefined();
  });
});
