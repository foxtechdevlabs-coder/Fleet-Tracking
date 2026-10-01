// Admin entity — system user / fleet manager.
import { EntitySchema } from "@mikro-orm/core";

export class Admin {
  id!: string;
  email!: string;
  passwordHash!: string;
  name!: string;
  role!: "super_admin" | "admin";
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
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
