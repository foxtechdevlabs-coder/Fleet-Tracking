// Admin entity — system user / fleet manager.
import { EntitySchema, type Opt } from "@mikro-orm/core";
import type { AdminProfile } from "./admin.types.js";

export class Admin {
  id!: string & Opt;
  email!: string;
  passwordHash!: string;
  name!: string;
  role!: ("super_admin" | "admin") & Opt;
  isActive!: boolean & Opt;
  createdAt!: Date & Opt;
  updatedAt!: Date & Opt;
  toProfile(): AdminProfile {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export const AdminSchema = new EntitySchema<Admin>({
  class: Admin,
  tableName: "admins",
  properties: {
    id: {
      type: "uuid",
      primary: true,
      defaultRaw: "gen_random_uuid()",
    },
    email: {
      type: "string",
      length: 255,
      unique: true,
    },
    passwordHash: {
      type: "string",
      columnType: "text",
      fieldName: "password_hash",
      hidden: true,
    },
    name: {
      type: "string",
      length: 255,
    },
    role: {
      type: "string",
      length: 50,
      default: "admin",
      comment: "Allowed values: super_admin, admin",
    },
    isActive: {
      type: "boolean",
      fieldName: "is_active",
      default: true,
    },
    createdAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "created_at",
      onCreate: () => new Date(),
    },
    updatedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "updated_at",
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
    },
  },
});
