// MikroORM configuration.
import { defineConfig } from "@mikro-orm/postgresql";
import { databaseConfig } from "../config/database.js";
import { AdminSchema } from "../modules/admins/admin.entity.js";
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
});
