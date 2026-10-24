// Admin types and data transfer objects.
import type { Admin } from "./admin.entity.js";

export type AdminRole = "super_admin" | "admin";

/** Safe admin representation omitting sensitive credentials like passwordHash */
export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminInput {
  email: string;
  password?: string;
  passwordHash?: string;
  name: string;
  role?: AdminRole;
  isActive?: boolean;
}

export type CreateAdminDto = CreateAdminInput;

export interface UpdateAdminInput {
  email?: string;
  password?: string;
  passwordHash?: string;
  name?: string;
  role?: AdminRole;
  isActive?: boolean;
}

export type UpdateAdminDto = UpdateAdminInput;

/** Maps an Admin entity to an AdminProfile, safely excluding the password hash */
export function toAdminProfile(admin: Admin): AdminProfile {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    isActive: admin.isActive,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}
