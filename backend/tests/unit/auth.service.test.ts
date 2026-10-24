// Unit tests for admin password hashing, access tokens, login input and credential checks.
import { describe, expect, it, jest } from "@jest/globals";
import type { EntityManager } from "@mikro-orm/postgresql";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { parseLoginInput } from "../../src/modules/auth/auth.schema.js";
import {
  authenticateAdmin,
  createAccessToken,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
} from "../../src/modules/auth/auth.service.js";

describe("parseLoginInput", () => {
  it("normalizes a valid email and keeps the password", () => {
    expect(
      parseLoginInput({
        email: "  Admin@Example.com ",
        password: "SecretPassword123!",
      }),
    ).toEqual({ email: "admin@example.com", password: "SecretPassword123!" });
  });

  it.each([
    null,
    [],
    "text",
    { email: "not-an-email", password: "x" },
    { email: "admin@example.com", password: "" },
  ])("rejects invalid input %p", (body) => {
    expect(() => parseLoginInput(body)).toThrow();
  });
});

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("CorrectPassword123!");

    expect(hash.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("CorrectPassword123!", hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("WrongPassword!", hash)).resolves.toBe(false);
  });

  it("rejects a missing or malformed stored hash", async () => {
    await expect(verifyPassword("anything", undefined)).resolves.toBe(false);
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
  });
});

describe("access tokens", () => {
  const admin = {
    id: "44444444-4444-4444-4444-444444444444",
    email: "admin@example.com",
    role: "super_admin" as const,
  };

  it("creates a 3-part token whose claims verify", () => {
    const { token, tokenId, expiresAt } = createAccessToken(admin);

    expect(token.split(".")).toHaveLength(3);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const claims = verifyAccessToken(token);
    expect(claims).toMatchObject({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      jti: tokenId,
    });
  });

  it("rejects a tampered payload", () => {
    const [header, , sig] = createAccessToken(admin).token.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ sub: "hacked", email: admin.email, role: "admin" }),
    ).toString("base64url");

    expect(verifyAccessToken(`${header}.${tampered}.${sig}`)).toBeUndefined();
  });

  it("rejects an expired token", () => {
    const issuedTwoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
    const { token } = createAccessToken(admin, issuedTwoHoursAgo);

    expect(verifyAccessToken(token)).toBeUndefined();
  });

  it("rejects a token that is not three parts", () => {
    expect(verifyAccessToken("abc.def")).toBeUndefined();
  });
});

describe("authenticateAdmin", () => {
  async function setup(overrides: Partial<Admin> = {}) {
    const admin = Object.assign(new Admin(), {
      id: "44444444-4444-4444-4444-444444444444",
      email: "admin@example.com",
      name: "Super Admin",
      role: "super_admin",
      isActive: true,
      passwordHash: await hashPassword("CorrectPassword123!"),
      ...overrides,
    });
    const em = {
      findOne: jest.fn<() => Promise<Admin | null>>().mockResolvedValue(admin),
    } as unknown as EntityManager;
    return { admin, em };
  }

  it("returns the admin for correct credentials", async () => {
    const { admin, em } = await setup();

    await expect(
      authenticateAdmin(em, "admin@example.com", "CorrectPassword123!"),
    ).resolves.toBe(admin);
  });

  it("returns undefined for a wrong password", async () => {
    const { em } = await setup();

    await expect(
      authenticateAdmin(em, "admin@example.com", "WrongPassword!"),
    ).resolves.toBeUndefined();
  });

  it("returns undefined for an inactive admin", async () => {
    const { em } = await setup({ isActive: false });

    await expect(
      authenticateAdmin(em, "admin@example.com", "CorrectPassword123!"),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when no admin exists", async () => {
    const em = {
      findOne: jest.fn<() => Promise<Admin | null>>().mockResolvedValue(null),
    } as unknown as EntityManager;

    await expect(
      authenticateAdmin(em, "missing@example.com", "Anything123!"),
    ).resolves.toBeUndefined();
  });
});
