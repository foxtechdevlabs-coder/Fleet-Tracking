// HTTP tests for administrator login, profile, and logout.
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { hashPassword } from "../../src/modules/auth/auth.service.js";
import type { RevokedToken } from "../../src/modules/auth/revoked-token.entity.js";

describe("administrator authentication API", () => {
  it("authenticates, protects the profile, and revokes the logged-out token", async () => {
    const admin = Object.assign(new Admin(), {
      id: "44444444-4444-4444-4444-444444444444",
      email: "admin@example.com",
      name: "Test Admin",
      role: "admin" as const,
      isActive: true,
      passwordHash: await hashPassword("CorrectPassword123!"),
    });
    const revokedTokens: RevokedToken[] = [];
    const em = {
      async findOne(entity: typeof Admin | typeof RevokedToken, where: object) {
        if (entity === Admin) {
          return Object.entries(where).every(
            ([key, value]) => admin[key as keyof Admin] === value,
          )
            ? admin
            : null;
        }
        return (
          revokedTokens.find((token) =>
            Object.entries(where).every(
              ([key, value]) => token[key as keyof RevokedToken] === value,
            ),
          ) ?? null
        );
      },
      async nativeDelete() {},
      async insert(_entity: typeof RevokedToken, token: RevokedToken) {
        revokedTokens.push(token);
      },
    };
    const app = createApp({ em: { fork: () => em } } as never);

    const missingFields = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email });
    expect(missingFields.status).toBe(400);

    const invalidCredentials = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: "IncorrectPassword123!" });
    expect(invalidCredentials.status).toBe(401);
    expect(JSON.stringify(invalidCredentials.body)).not.toContain(
      "IncorrectPassword123!",
    );

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: admin.email, password: "CorrectPassword123!" });
    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 3600,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
    expect(login.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(login.body)).not.toContain(admin.passwordHash);

    const profile = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data).toEqual({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(logout.status).toBe(204);

    const revokedProfile = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(revokedProfile.status).toBe(401);
    expect(revokedProfile.body).toEqual({
      success: false,
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });
});
