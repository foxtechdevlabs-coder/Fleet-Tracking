// Schema creation script — executes the SQL migration against the configured database.
// Usage: pnpm run db:schema:create
//
// Reads src/database/migrations/001_initial_schema.sql and executes it inside a transaction.
// All statements use CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS so it is safe
// to run multiple times (idempotent).
//
// Run `pnpm run db:schema:sql` first to preview the SQL without touching the database.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MikroORM } from "@mikro-orm/postgresql";
import mikroOrmConfig from "./mikro-orm.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "migrations", "001_initial_schema.sql");
const sql = await readFile(sqlPath, "utf-8");

const orm = await MikroORM.init(mikroOrmConfig);
try {
  const connection = orm.em.getConnection();
  await connection.execute(sql);
  console.log("✅ Database schema applied successfully.");
} catch (error: unknown) {
  console.error("❌ Schema creation failed:", error);
  process.exit(1);
} finally {
  await orm.close(true);
}
