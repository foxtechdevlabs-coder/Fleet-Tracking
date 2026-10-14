// Database connection configuration.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConnectionOptions } from "node:tls";
import { fileURLToPath } from "node:url";
import { env, isDevelopment } from "./env.js";

// backend/ — the same from src/config/ (tsx) and dist/config/ (compiled), so a relative
// DATABASE_SSL_CA works regardless of the directory the process was started from.
const backendDir = fileURLToPath(new URL("../../", import.meta.url));

function readCaCertificate(path: string): string {
  const absolutePath = resolve(backendDir, path);
  let content: string;

  try {
    content = readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`DATABASE_SSL_CA file cannot be read: ${absolutePath}`, {
      cause: error,
    });
  }

  if (!content.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(
      `DATABASE_SSL_CA is not a PEM certificate file: ${absolutePath}`,
    );
  }

  return content;
}

// MikroORM ignores query parameters such as `?sslmode=` in the connection URL,
// so TLS is configured here and passed to the `pg` pool via `driverOptions`.
function ssl(): false | ConnectionOptions {
  switch (env.databaseSsl) {
    case "disable":
      return false;
    case "require":
      return { rejectUnauthorized: false };
    case "verify-full":
      return {
        rejectUnauthorized: true,
        ca: env.databaseSslCa
          ? readCaCertificate(env.databaseSslCa)
          : undefined,
      };
  }
}

export const databaseConfig = {
  url: env.databaseUrl,
  debug: isDevelopment,
  ssl: ssl(),
} as const;
