// Unit tests for AuthService, token issuance, and auth schemas.
import { describe, expect, it, jest } from "@jest/globals";
import { hashPassword } from "../../src/common/utils/password.util.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import type { AdminRepository } from "../../src/modules/admins/admin.repository.js";
import {
  validateCreateAdminInput,
  validateLoginCredentials,
} from "../../src/modules/auth/auth.schema.js";
import {
  AuthService,
  signJwt,
  verifyJwt,
} from "../../src/modules/auth/auth.service.js";

describe("Auth Schemas", () => {
  it("validates valid login credentials", () => {
    const result = validateLoginCredentials({
      email: "Admin@Example.com",
      password: "SecretPassword123!",
    });

    expect(result.isValid).toBe(true);
    expect(result.data).toEqual({
      email: "admin@example.com",
      password: "SecretPassword123!",
    });
  });

  it("rejects invalid email and missing password", () => {
    const result = validateLoginCredentials({
      email: "not-an-email",
      password: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Invalid email format");
    expect(result.errors).toContain("Password is required");
  });

  it("validates create admin input", () => {
    const result = validateCreateAdminInput({
      email: "new@example.com",
      password: "Password123!",
      name: "New Admin",
      role: "admin",
    });

    expect(result.isValid).toBe(true);
    expect(result.data?.email).toBe("new@example.com");
  });

  it("rejects create admin input with short password", () => {
    const result = validateCreateAdminInput({
      email: "new@example.com",
      password: "short",
      name: "New Admin",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must be at least 8 characters long",
    );
  });
});

describe("JWT Signing and Verification", () => {
  const secret = "test-secret-key-12345";

  it("generates a 3-part signed JWT and verifies payload correctly", () => {
    const payload = {
      sub: "123e4567-e89b-12d3-a456-426614174000",
      email: "test@example.com",
      role: "super_admin",
    };

    const token = signJwt(payload, secret, 3600);
    expect(token.split(".")).toHaveLength(3);

    const verified = verifyJwt<typeof payload>(token, secret);
    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.role).toBe(payload.role);
  });

  it("rejects token signed with a different secret", () => {
    const token = signJwt({ sub: "123" }, secret);
    expect(() => verifyJwt(token, "wrong-secret")).toThrow(
      "Invalid JWT signature",
    );
  });

  it("rejects tampered token payload", () => {
    const token = signJwt({ sub: "123" }, secret);
    const [header, , sig] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "hacked" }),
    ).toString("base64url");
    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

    expect(() => verifyJwt(tamperedToken, secret)).toThrow(
      "Invalid JWT signature",
    );
  });

  it("rejects expired token", () => {
    // Generate token that expired 10 seconds ago
    const token = signJwt({ sub: "123" }, secret, -10);
    expect(() => verifyJwt(token, secret)).toThrow("JWT token has expired");
  });
});

describe("AuthService", () => {
  const testSecret = "jwt-super-secret-key";

  async function createMockAdmin(): Promise<Admin> {
    const admin = new Admin();
    admin.id = "44444444-4444-4444-4444-444444444444";
    admin.email = "admin@example.com";
    admin.name = "Super Admin";
    admin.role = "super_admin";
    admin.isActive = true;
    admin.passwordHash = await hashPassword("CorrectPassword123!");
    admin.createdAt = new Date();
    admin.updatedAt = new Date();
    return admin;
  }

  it("validates credentials and returns safe AdminProfile", async () => {
    const admin = await createMockAdmin();
    const mockRepo = {
      findByEmail: jest
        .fn<() => Promise<Admin | null>>()
        .mockResolvedValue(admin),
    } as unknown as AdminRepository;

    const authService = new AuthService(mockRepo, testSecret);
    const profile = await authService.validateCredentials({
      email: "admin@example.com",
      password: "CorrectPassword123!",
    });

    expect(profile).not.toBeNull();
    expect(profile?.email).toBe("admin@example.com");
    expect((profile as unknown as Record<string, unknown>)?.passwordHash).toBeUndefined();
  });

  it("returns null on incorrect password", async () => {
    const admin = await createMockAdmin();
    const mockRepo = {
      findByEmail: jest
        .fn<() => Promise<Admin | null>>()
        .mockResolvedValue(admin),
    } as unknown as AdminRepository;

    const authService = new AuthService(mockRepo, testSecret);
    const profile = await authService.validateCredentials({
      email: "admin@example.com",
      password: "WrongPassword!",
    });

    expect(profile).toBeNull();
  });

  it("returns null if admin is inactive", async () => {
    const admin = await createMockAdmin();
    admin.isActive = false;
    const mockRepo = {
      findByEmail: jest
        .fn<() => Promise<Admin | null>>()
        .mockResolvedValue(admin),
    } as unknown as AdminRepository;

    const authService = new AuthService(mockRepo, testSecret);
    const profile = await authService.validateCredentials({
      email: "admin@example.com",
      password: "CorrectPassword123!",
    });

    expect(profile).toBeNull();
  });

  it("successful login returns AuthResponse with accessToken and safe AdminProfile", async () => {
    const admin = await createMockAdmin();
    const mockRepo = {
      findByEmail: jest
        .fn<() => Promise<Admin | null>>()
        .mockResolvedValue(admin),
    } as unknown as AdminRepository;

    const authService = new AuthService(mockRepo, testSecret, 3600);
    const result = await authService.login({
      email: "admin@example.com",
      password: "CorrectPassword123!",
    });

    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresIn).toBe(3600);
    expect(result.accessToken).toBeTruthy();
    expect(result.admin.id).toBe(admin.id);
    expect(result.admin.email).toBe(admin.email);
    expect((result.admin as any).passwordHash).toBeUndefined();

    // Verify the returned token
    const decoded = authService.verifyToken(result.accessToken);
    expect(decoded.sub).toBe(admin.id);
    expect(decoded.email).toBe(admin.email);
    expect(decoded.role).toBe(admin.role);
  });

  it("login throws on invalid password", async () => {
    const admin = await createMockAdmin();
    const mockRepo = {
      findByEmail: jest
        .fn<() => Promise<Admin | null>>()
        .mockResolvedValue(admin),
    } as unknown as AdminRepository;

    const authService = new AuthService(mockRepo, testSecret);
    await expect(
      authService.login({
        email: "admin@example.com",
        password: "BadPassword",
      }),
    ).rejects.toThrow("Invalid email or password");
  });
});
