// Login brute-force protection: per-IP and per-account limits on failed attempts.
import { describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { errorHandler } from "../../src/common/errors/error-handler.js";
import { createLoginRateLimit } from "../../src/common/middleware/rate-limit.middleware.js";

// A stand-in for the login handler: "correct" password succeeds, anything else fails.
function limiterApp() {
  const app = express();
  app.set("trust proxy", true); // lets tests choose the client IP via X-Forwarded-For
  app.use(express.json());
  app.post("/login", ...createLoginRateLimit(), (req, res) => {
    res.status(req.body.password === "correct" ? 200 : 401).json({});
  });
  app.use(errorHandler);
  return app;
}

function attempt(
  app: express.Express,
  ip: string,
  email: string,
  password = "wrong",
) {
  return request(app)
    .post("/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password });
}

describe("login rate limiting", () => {
  it("blocks an IP after 10 failed attempts, before the login handler runs", async () => {
    const app = limiterApp();
    for (let i = 0; i < 10; i++) {
      expect(
        (await attempt(app, "203.0.113.1", `user${i}@example.com`)).status,
      ).toBe(401);
    }

    const blocked = await attempt(app, "203.0.113.1", "other@example.com");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Too many failed login attempts. Try again later.",
      code: "TOO_MANY_LOGIN_ATTEMPTS",
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);

    // Even the correct password is refused while the IP is blocked.
    expect(
      (await attempt(app, "203.0.113.1", "a@example.com", "correct")).status,
    ).toBe(429);
    // Other clients are unaffected.
    expect((await attempt(app, "203.0.113.2", "a@example.com")).status).toBe(
      401,
    );
  });

  it("does not count successful logins", async () => {
    const app = limiterApp();
    for (let i = 0; i < 30; i++) {
      expect(
        (await attempt(app, "203.0.113.3", "a@example.com", "correct")).status,
      ).toBe(200);
    }
    expect((await attempt(app, "203.0.113.3", "a@example.com")).status).toBe(
      401,
    );
  });

  it("blocks an account after 20 failed attempts spread across IPs", async () => {
    const app = limiterApp();
    for (let i = 0; i < 20; i++) {
      // Mixed case and whitespace must still count against the same account.
      const email = i % 2 ? " Target@Example.com " : "target@example.com";
      expect((await attempt(app, `198.51.100.${i}`, email)).status).toBe(401);
    }

    expect(
      (await attempt(app, "198.51.100.200", "target@example.com")).status,
    ).toBe(429);
    // A different account from a fresh IP is unaffected.
    expect(
      (await attempt(app, "198.51.100.201", "someone@example.com")).status,
    ).toBe(401);
  });

  it("is applied to POST /api/v1/auth/login and stops before credentials are checked", async () => {
    let adminLookups = 0;
    const em = {
      async findOne() {
        adminLookups++;
        return null; // unknown admin: login fails with 401
      },
    };
    const app = createApp({ em: { fork: () => em } } as never);
    const login = () =>
      request(app)
        .post("/api/v1/auth/login")
        .send({ email: "admin@example.com", password: "wrong-password" });

    for (let i = 0; i < 10; i++) {
      expect((await login()).status).toBe(401);
    }
    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("TOO_MANY_LOGIN_ATTEMPTS");
    expect(adminLookups).toBe(10); // the 11th attempt never reached the database or scrypt
  });
});
