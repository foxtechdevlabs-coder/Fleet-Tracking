// Environment variable loading and validation.
import { config } from "dotenv";

config({ quiet: true });

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function port(name: string): number {
  const raw = required(name);
  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid ${name}: "${raw}" is not a valid port number`);
  }

  return value;
}

function origins(name: string): string[] {
  const configured = process.env[name]?.trim();
  const values = configured ? configured.split(",") : ["http://localhost:5173"];

  return [
    ...new Set(
      values.map((value) => {
        const candidate = value.trim();
        let parsed: URL;

        try {
          parsed = new URL(candidate);
        } catch {
          throw new Error(
            `Invalid ${name}: each value must be an HTTP(S) origin`,
          );
        }

        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password ||
          parsed.pathname !== "/" ||
          parsed.search ||
          parsed.hash
        ) {
          throw new Error(
            `Invalid ${name}: each value must be an HTTP(S) origin`,
          );
        }

        return parsed.origin;
      }),
    ),
  ];
}

function jwtSecret(): string {
  const value = required("JWT_SECRET");

  if (Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("Invalid JWT_SECRET: use at least 32 bytes of random data");
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV?.trim() || "development",

  port: port("PORT"),

  frontendOrigins: origins("FRONTEND_ORIGINS"),

  jwtSecret: jwtSecret(),

  databaseUrl:
    process.env.DATABASE_URL?.trim() ||
    `postgresql://${encodeURIComponent(
      required("DB_USERNAME"),
    )}:${encodeURIComponent(
      required("DB_PASSWORD"),
    )}@${required("DB_HOST")}:${port("DB_PORT")}/${required("DB_NAME")}`,
} as const;

export const isDevelopment = env.nodeEnv === "development";
