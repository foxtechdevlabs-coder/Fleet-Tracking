// General API rate limiting: per-IP request limits for /api/* and GPS ingest.
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";

// No ORM: protected routes reject the missing bearer token with 401 before any
// database access, which is enough to observe where the limiter cuts in.
async function send(count: number, call: () => request.Test) {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    statuses.push((await call()).status);
  }
  return statuses;
}

describe("API rate limiting", () => {
  it("uses the defaults when the environment does not set limits", () => {
    expect(env.apiRateLimitPerMinute).toBe(300);
    expect(env.ingestRateLimitPerMinute).toBe(1200);
  });

  it("returns 429 once an IP exceeds the general API limit", async () => {
    const app = createApp();
    const statuses = await send(env.apiRateLimitPerMinute, () =>
      request(app).get("/api/vehicles"),
    );
    expect(new Set(statuses)).toEqual(new Set([401]));

    const blocked = await request(app).get("/api/v1/devices");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Too many requests. Try again later.",
      code: "TOO_MANY_REQUESTS",
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.headers.ratelimit).toBeDefined();
  });

  it("never limits health checks", async () => {
    const app = createApp();
    const statuses = await send(env.apiRateLimitPerMinute + 20, () =>
      request(app).get("/api/v1/health"),
    );
    expect(new Set(statuses)).toEqual(new Set([200]));
    expect((await request(app).get("/health")).status).toBe(200);
  });

  it("gives GPS ingest its own, higher limit", async () => {
    const app = createApp();

    // Exhaust the general limit: ingest keeps working.
    await send(env.apiRateLimitPerMinute + 1, () =>
      request(app).get("/api/vehicles"),
    );
    expect((await request(app).get("/api/vehicles")).status).toBe(429);
    expect((await request(app).post("/api/v1/tracking/ingest")).status).toBe(
      401,
    );

    // Ingest is limited separately, at its own limit (one request already used above).
    const statuses = await send(env.ingestRateLimitPerMinute - 1, () =>
      request(app).post("/api/v1/tracking/ingest"),
    );
    expect(new Set(statuses)).toEqual(new Set([401]));
    const blocked = await request(app).post("/api/v1/tracking/ingest");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("TOO_MANY_REQUESTS");
  });

  it("keeps separate counters per app instance", async () => {
    const first = createApp();
    await send(env.apiRateLimitPerMinute + 1, () =>
      request(first).get("/api/vehicles"),
    );
    expect((await request(first).get("/api/vehicles")).status).toBe(429);
    expect((await request(createApp()).get("/api/vehicles")).status).toBe(401);
  });
});
