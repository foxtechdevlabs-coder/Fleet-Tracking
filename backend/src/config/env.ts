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

export const env = {
  nodeEnv: process.env.NODE_ENV?.trim() || "development",

  port: port("PORT"),

  databaseUrl:
    process.env.DATABASE_URL?.trim() ||
    `postgresql://${encodeURIComponent(
      required("DB_USERNAME")
    )}:${encodeURIComponent(
      required("DB_PASSWORD")
    )}@${required("DB_HOST")}:${port("DB_PORT")}/${required("DB_NAME")}`,
} as const;

export const isDevelopment = env.nodeEnv === "development";