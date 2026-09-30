// Database connection configuration.
import { env, isDevelopment } from "./env.js";

export const databaseConfig = {
  url: env.databaseUrl,
  debug: isDevelopment,
} as const;
