import { describe, expect, it } from "@jest/globals";
import { crossFieldProblems } from "../../src/config/env.js";
import { requireInitialAdminCredentials } from "../../src/database/seeds/admin.seed.js";

describe("production configuration safeguards", () => {
  it("requires verified PostgreSQL TLS in production", () => {
    const problems = crossFieldProblems({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@db.example.test:5432/fleet",
      DATABASE_SSL: "require",
    });

    expect(problems).toContain(
      "DATABASE_SSL: must be verify-full in production",
    );
  });

  it("accepts verified PostgreSQL TLS in production", () => {
    const problems = crossFieldProblems({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@db.example.test:5432/fleet",
      DATABASE_SSL: "verify-full",
    });

    expect(problems).not.toContain(
      "DATABASE_SSL: must be verify-full in production",
    );
  });

  it("requires initial admin seed credentials instead of using defaults", () => {
    expect(() => requireInitialAdminCredentials(undefined, undefined)).toThrow(
      "ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD must be configured in environment",
    );
    expect(
      requireInitialAdminCredentials("ops@example.test", "long-enough-secret"),
    ).toEqual({
      email: "ops@example.test",
      password: "long-enough-secret",
    });
  });
});
