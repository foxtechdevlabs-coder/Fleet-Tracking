// Isolated PostgreSQL database for integration tests (real SQL, real transactions).
//
// Opt-in: set TEST_DATABASE_URL to a *local* PostgreSQL server whose user may create
// databases, e.g. postgresql://postgres@127.0.0.1:5432/postgres. Each test file creates
// a fresh, uniquely named database, applies the project's MikroORM migrations, and drops
// that database afterwards. The app's DATABASE_URL (the shared Supabase database) is
// never used, and non-local hosts are refused.
import { randomBytes } from "node:crypto";
import { describe } from "@jest/globals";
import { MikroORM } from "@mikro-orm/postgresql";
import { Migration20261006142112_InitialSchema } from "../../src/database/migrations/Migration20261006142112_InitialSchema.js";
import { Migration20261008110000_TrackingLocationIdempotency } from "../../src/database/migrations/Migration20261008110000_TrackingLocationIdempotency.js";
import { Migration20261011132554_LatestLocationRecordedAt } from "../../src/database/migrations/Migration20261011132554_LatestLocationRecordedAt.js";
import mikroOrmConfig from "../../src/database/mikro-orm.config.js";

const rawUrl = process.env.TEST_DATABASE_URL?.trim();

/** `describe` when TEST_DATABASE_URL is set, otherwise `describe.skip`. */
export const describeWithDatabase = rawUrl ? describe : describe.skip;

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function serverUrl(): URL {
  if (!rawUrl) throw new Error("TEST_DATABASE_URL is not set");
  const url = new URL(rawUrl);
  if (!localHosts.has(url.hostname)) {
    throw new Error(
      `TEST_DATABASE_URL must point to a local PostgreSQL server (got host "${url.hostname}"); integration tests create and drop databases`,
    );
  }
  return url;
}

function ormFor(url: URL, withMigrations: boolean) {
  return MikroORM.init({
    ...mikroOrmConfig,
    clientUrl: url.toString(),
    // Local test server: no TLS (the app's DATABASE_SSL settings target Supabase).
    driverOptions: { ssl: false },
    debug: false,
    migrations: {
      ...mikroOrmConfig.migrations,
      snapshot: false,
      migrationsList: withMigrations
        ? [
            Migration20261006142112_InitialSchema,
            Migration20261008110000_TrackingLocationIdempotency,
            Migration20261011132554_LatestLocationRecordedAt,
          ]
        : [],
    },
  });
}

export interface TestDatabase {
  orm: MikroORM;
  name: string;
  /** Closes the ORM and drops the database created for this run. */
  drop(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const server = serverUrl();
  const name = `fleet_it_${Date.now()}_${randomBytes(4).toString("hex")}`;

  const admin = await ormFor(server, false);
  await admin.connect();
  // `name` is generated above (letters, digits, underscores): safe as an identifier.
  await admin.em.getConnection().execute(`CREATE DATABASE "${name}"`);

  const url = new URL(server);
  url.pathname = `/${name}`;
  const orm = await ormFor(url, true);
  try {
    await orm.connect();
    await orm.migrator.up();
  } catch (error) {
    await orm.close(true);
    await admin.em
      .getConnection()
      .execute(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.close(true);
    throw error;
  }

  return {
    orm,
    name,
    async drop() {
      await orm.close(true);
      await admin.em
        .getConnection()
        .execute(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.close(true);
    },
  };
}
