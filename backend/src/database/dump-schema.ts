// Schema SQL preview — prints the migration SQL to stdout without touching the database.
// Usage: pnpm run db:schema:sql
//
// Does NOT require a database connection; it simply reads and prints the migration file.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "migrations", "001_initial_schema.sql");
const sql = await readFile(sqlPath, "utf-8");

console.log(sql);
