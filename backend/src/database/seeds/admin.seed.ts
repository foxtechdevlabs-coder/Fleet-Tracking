// Admin seeding script — initializes primary administrator account if none exists.
// Usage: pnpm run db:seed:admin
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MikroORM } from "@mikro-orm/postgresql";
import { hashPassword } from "../../common/utils/password.util.js";
import { env } from "../../config/env.js";
import { AdminRepository } from "../../modules/admins/admin.repository.js";
import type { AdminProfile } from "../../modules/admins/admin.types.js";
import { toAdminProfile } from "../../modules/admins/admin.types.js";
import mikroOrmConfig from "../mikro-orm.config.js";

export interface SeedResult {
  seeded: boolean;
  message: string;
  admin?: AdminProfile;
}

/**
 * Idempotently seeds the single primary administrator account.
 * Skips creation if an administrator record already exists in the database.
 */
export async function seedAdmin(ormInstance?: MikroORM): Promise<SeedResult> {
  const shouldClose = !ormInstance;
  const orm = ormInstance ?? (await MikroORM.init(mikroOrmConfig));

  try {
    const em = orm.em.fork();
    const adminRepo = new AdminRepository(em);

    const existingCount = await adminRepo.count();
    if (existingCount > 0) {
      const message = `Admin already exists (${existingCount} administrator account(s) present). Seeding skipped.`;
      console.log(`ℹ️  ${message}`);
      return { seeded: false, message };
    }

    const email = env.adminInitialEmail;
    const password = env.adminInitialPassword;
    const name = env.adminInitialName;

    if (!email || !password) {
      throw new Error(
        "ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD must be configured in environment",
      );
    }

    console.log(`🌱 Seeding initial administrator (${email})...`);
    const passwordHash = await hashPassword(password);

    const admin = await adminRepo.createAdmin({
      email,
      name,
      passwordHash,
      role: "super_admin",
      isActive: true,
    });

    const profile = toAdminProfile(admin);
    const message = `Primary administrator created successfully: ${profile.email} (${profile.role}).`;
    console.log(`✅ ${message}`);
    return { seeded: true, message, admin: profile };
  } catch (error: unknown) {
    console.error("❌ Admin seeding error:", error);
    throw error;
  } finally {
    if (shouldClose) {
      await orm.close(true);
    }
  }
}

// Execute when run as a standalone CLI script
const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (
  executedFile === currentFile ||
  process.argv[1]?.replace(/\\/g, "/").includes("seeds/admin.seed")
) {
  seedAdmin()
    .then((result) => {
      console.log(
        `[db:seed:admin] Completed: ${result.seeded ? "Created admin" : "Already seeded"}`,
      );
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("[db:seed:admin] Failed:", error);
      process.exit(1);
    });
}
