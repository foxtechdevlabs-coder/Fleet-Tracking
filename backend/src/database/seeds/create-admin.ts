// Create the first administrator from one-time environment variables.
import { MikroORM } from "@mikro-orm/postgresql";
import { Admin } from "../../modules/admins/admin.entity.js";
import { hashPassword } from "../../modules/auth/auth.service.js";
import mikroOrmConfig from "../mikro-orm.config.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function createAdmin(): Promise<void> {
  const email = required("ADMIN_EMAIL").toLowerCase();
  const name = required("ADMIN_NAME");
  const password = process.env.ADMIN_PASSWORD;
  const role = process.env.ADMIN_ROLE?.trim() || "super_admin";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (name.length > 255) {
    throw new Error("ADMIN_NAME must be no more than 255 characters");
  }
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must be 12-128 characters");
  }
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("ADMIN_ROLE must be admin or super_admin");
  }

  const orm = await MikroORM.init(mikroOrmConfig);
  try {
    await orm.connect();

    const em = orm.em.fork();

    const existing = await em.findOne(Admin, { email });

    if (existing) {
      throw new Error("An administrator with ADMIN_EMAIL already exists");
    }

    const now = new Date();

    const admin = em.create(Admin, {
      email,
      name,
      role,
      passwordHash: await hashPassword(password),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    em.persist(admin);
    await em.flush();
    console.log(`Administrator ${email} created with role ${role}.`);
  } finally {
    await orm.close(true);
  }
}

createAdmin().catch((error: unknown) => {
  console.error("Failed to create administrator:", error);
  process.exitCode = 1;
});
