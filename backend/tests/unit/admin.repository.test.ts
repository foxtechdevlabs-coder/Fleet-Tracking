// Unit tests for AdminRepository and Admin types.
import { describe, expect, it, jest } from "@jest/globals";
import type { EntityManager } from "@mikro-orm/postgresql";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { AdminRepository } from "../../src/modules/admins/admin.repository.js";
import { toAdminProfile } from "../../src/modules/admins/admin.types.js";

describe("Admin Types & Repository", () => {
  it("toAdminProfile strips sensitive passwordHash", () => {
    const admin = new Admin();
    admin.id = "11111111-1111-1111-1111-111111111111";
    admin.email = "admin@example.com";
    admin.name = "Test Admin";
    admin.passwordHash = "secret_salt:secret_derived_key";
    admin.role = "super_admin";
    admin.isActive = true;
    admin.createdAt = new Date("2026-01-01T00:00:00Z");
    admin.updatedAt = new Date("2026-01-01T00:00:00Z");

    const profile = toAdminProfile(admin);

    expect(profile).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      email: "admin@example.com",
      name: "Test Admin",
      role: "super_admin",
      isActive: true,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    });
    expect(
      (profile as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
  });

  it("Admin.toProfile() method strips sensitive passwordHash", () => {
    const admin = new Admin();
    admin.id = "22222222-2222-2222-2222-222222222222";
    admin.email = "fleet@example.com";
    admin.name = "Fleet Manager";
    admin.passwordHash = "another_secret_hash";
    admin.role = "admin";
    admin.isActive = true;
    admin.createdAt = new Date();
    admin.updatedAt = new Date();

    const profile = admin.toProfile();

    expect(
      (profile as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
    expect(profile.email).toBe("fleet@example.com");
  });

  it("AdminRepository findByEmail queries lowercase normalized email", async () => {
    const mockFindOne =
      jest.fn<(...args: unknown[]) => Promise<Admin | null>>();
    const mockEm = {
      findOne: mockFindOne,
    } as unknown as EntityManager;

    const repo = new AdminRepository(mockEm);
    await repo.findByEmail("  ADMIN@Example.COM  ");

    expect(mockFindOne).toHaveBeenCalledWith(Admin, {
      email: "admin@example.com",
    });
  });

  it("AdminRepository findById queries by UUID", async () => {
    const mockFindOne =
      jest.fn<(...args: unknown[]) => Promise<Admin | null>>();
    const mockEm = {
      findOne: mockFindOne,
    } as unknown as EntityManager;

    const repo = new AdminRepository(mockEm);
    const id = "33333333-3333-3333-3333-333333333333";
    await repo.findById(id);

    expect(mockFindOne).toHaveBeenCalledWith(Admin, { id });
  });

  it("AdminRepository count delegates to em.count", async () => {
    const mockCount = jest
      .fn<(entity: unknown) => Promise<number>>()
      .mockResolvedValue(1);
    const mockEm = {
      count: mockCount,
    } as unknown as EntityManager;

    const repo = new AdminRepository(mockEm);
    const count = await repo.count();

    expect(count).toBe(1);
    expect(mockCount).toHaveBeenCalledWith(Admin);
  });

  it("AdminRepository createAdmin hashes plain-text password if passwordHash is not provided", async () => {
    const mockCreated = new Admin();
    const mockCreate = jest
      .fn<(_entity: typeof Admin, _data: unknown) => Admin>()
      .mockReturnValue(mockCreated);
    const mockPersist = jest.fn().mockReturnThis();
    const mockFlush = jest.fn<() => Promise<void>>().mockResolvedValue();

    const mockEm = {
      create: mockCreate,
      persist: mockPersist,
      flush: mockFlush,
    } as unknown as EntityManager;

    const repo = new AdminRepository(mockEm);
    const admin = await repo.createAdmin({
      email: "NewAdmin@Example.com",
      name: "New Admin",
      password: "PlainTextPassword123!",
      role: "admin",
    });

    expect(admin).toBe(mockCreated);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockCreate.mock.calls[0];
    expect(callArgs[0]).toBe(Admin);
    const payload = callArgs[1] as Record<string, unknown>;
    expect(payload.email).toBe("newadmin@example.com");
    expect(payload.name).toBe("New Admin");
    expect(typeof payload.passwordHash).toBe("string");
    expect((payload.passwordHash as string).includes(":")).toBe(true);
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });
});
