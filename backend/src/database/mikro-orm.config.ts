// MikroORM configuration.
import { defineConfig } from "@mikro-orm/postgresql";
import { databaseConfig } from "../config/database.js";

export default defineConfig({
  clientUrl: databaseConfig.url,
  debug: databaseConfig.debug,
  // Never create the database automatically; a missing database is a startup error.
  ensureDatabase: false,
  // Entities are registered here as modules are implemented.
  entities: [],
  discovery: {
    warnWhenNoEntities: false,
  },
});
