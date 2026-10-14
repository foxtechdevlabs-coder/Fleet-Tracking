// Admin repository — data access and query operations for administrator accounts.
import type { EntityManager } from "@mikro-orm/postgresql";
import { hashPassword } from "../../common/utils/password.util.js";
import { Admin } from "./admin.entity.js";
import type { AdminProfile, CreateAdminDto } from "./admin.types.js";
import { toAdminProfile } from "./admin.types.js";

export class AdminRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * Finds an admin by their unique email address (case-insensitive).
   */
  async findByEmail(email: string): Promise<Admin | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.em.findOne(Admin, { email: normalizedEmail });
  }

  /**
   * Finds an admin by their unique UUID.
   */
  async findById(id: string): Promise<Admin | null> {
    return this.em.findOne(Admin, { id });
  }

  /**
   * Returns total count of registered administrators.
   */
  async count(): Promise<number> {
    return this.em.count(Admin);
  }

  /**
   * Creates a new admin record. Hashes plain-text password if passwordHash is not already supplied.
   */
  async createAdmin(data: CreateAdminDto): Promise<Admin> {
    let passwordHash = data.passwordHash;
    if (!passwordHash) {
      if (!data.password) {
        throw new Error("Either password or passwordHash must be provided");
      }
      passwordHash = await hashPassword(data.password);
    }

    const admin = this.em.create(Admin, {
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      passwordHash,
      role: data.role ?? "admin",
      isActive: data.isActive ?? true,
    });

    await this.em.persist(admin).flush();
    return admin;
  }

  /**
   * Retrieves an admin profile by email, omitting sensitive fields like passwordHash.
   */
  async findProfileByEmail(email: string): Promise<AdminProfile | null> {
    const admin = await this.findByEmail(email);
    return admin ? toAdminProfile(admin) : null;
  }

  /**
   * Retrieves an admin profile by UUID, omitting sensitive fields like passwordHash.
   */
  async findProfileById(id: string): Promise<AdminProfile | null> {
    const admin = await this.findById(id);
    return admin ? toAdminProfile(admin) : null;
  }

  /**
   * Retrieves the first administrator (useful for single-admin deployment checks).
   */
  async findFirst(): Promise<Admin | null> {
    return this.em.findOne(Admin, {});
  }

  /**
   * Retrieves the primary admin profile if one exists.
   */
  async findFirstProfile(): Promise<AdminProfile | null> {
    const admin = await this.findFirst();
    return admin ? toAdminProfile(admin) : null;
  }
}
