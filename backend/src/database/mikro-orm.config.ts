// MikroORM configuration.
import { Migrator } from "@mikro-orm/migrations";
import { defineConfig } from "@mikro-orm/postgresql";
import { databaseConfig } from "../config/database.js";
import { AdminSchema } from "../modules/admins/admin.entity.js";
import { RevokedTokenSchema } from "../modules/auth/revoked-token.entity.js";
import { DeviceSchema } from "../modules/devices/device.entity.js";
import { SystemSettingSchema } from "../modules/settings/settings.entity.js";
import { TelemetryEventSchema } from "../modules/telemetry/telemetry.entity.js";
import { LatestLocationSchema } from "../modules/tracking/latest-location.entity.js";
import { LocationHistorySchema } from "../modules/tracking/location.entity.js";
import { TripSchema } from "../modules/trips/trip.entity.js";
import { VehicleSchema } from "../modules/vehicles/vehicle.entity.js";

export default defineConfig({
  clientUrl: databaseConfig.url,
  debug: databaseConfig.debug,
  // Never create the database automatically; a missing database is a startup error.
  ensureDatabase: false,
  entities: [
    AdminSchema,
    RevokedTokenSchema,
    VehicleSchema,
    DeviceSchema,
    LocationHistorySchema,
    LatestLocationSchema,
    TripSchema,
    TelemetryEventSchema,
    SystemSettingSchema,
  ],
  discovery: {
    warnWhenNoEntities: false,
  },
  extensions: [Migrator],
  migrations: {
    path: "dist/database/migrations",
    pathTs: "src/database/migrations",
    // Keep the snapshot generated from the entities. Rebuilding it from the live database
    // after `migration:up` would bring in FKs and CHECKs the entities don't declare, so the
    // next `migration:create` would generate statements that drop them.
    snapshotOnMigrate: false,
  },
  schemaGenerator: {
    // The database is hosted on Supabase; MikroORM must only manage the `public` schema.
    ignoreSchema: [
      "auth",
      "extensions",
      "graphql",
      "graphql_public",
      "realtime",
      "storage",
      "vault",
    ],
  },
});
