// Environment variable loading and validation.
import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

// Unset, empty and whitespace-only values all count as "not provided".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, schema);

const requiredString = optional(z.string({ error: "is required" }));

const port = optional(
  z
    .string({ error: "is required" })
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, "must be between 1 and 65535")
        .max(65535, "must be between 1 and 65535"),
    ),
);

const origin = z.string().refine(
  (value) => {
    try {
      const parsed = new URL(value);
      return (
        ["http:", "https:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password &&
        parsed.pathname === "/" &&
        !parsed.search &&
        !parsed.hash
      );
    } catch {
      return false;
    }
  },
  {
    error: (issue) =>
      `"${issue.input}" is not an HTTP(S) origin (e.g. http://localhost:5173)`,
  },
);

const databaseSslModes = ["disable", "require", "verify-full"] as const;

const schema = z.object({
  NODE_ENV: optional(z.string().default("development")),
  PORT: port,
  FRONTEND_ORIGINS: optional(
    z
      .string()
      .default("http://localhost:5173")
      .transform((value) => value.split(",").map((item) => item.trim()))
      .pipe(z.array(origin))
      .transform((values) => [
        ...new Set(values.map((value) => new URL(value).origin)),
      ]),
  ),

  // Either DATABASE_URL, or all of the DB_* parts (see crossFieldProblems).
  DATABASE_URL: optional(z.string().optional()),
  DB_USERNAME: optional(z.string().optional()),
  DB_PASSWORD: optional(z.string().optional()),
  DB_HOST: optional(z.string().optional()),
  DB_PORT: optional(z.string().optional()),
  DB_NAME: optional(z.string().optional()),

  // "require" encrypts without verifying the server certificate; "verify-full" also
  // verifies it (against DATABASE_SSL_CA when set, otherwise the system CAs).
  DATABASE_SSL: optional(
    z
      .enum(databaseSslModes, {
        error: `must be one of ${databaseSslModes.join(", ")}`,
      })
      .default("require"),
  ),
  // Relative paths are resolved against the backend/ directory (see config/database.ts).
  DATABASE_SSL_CA: optional(z.string().optional()),

  JWT_SECRET: requiredString.refine(
    (value) => Buffer.byteLength(value, "utf8") >= 32,
    "must be at least 32 bytes of random data",
  ),

  ADMIN_INITIAL_EMAIL: optional(z.string().default("admin@example.com")),
  ADMIN_INITIAL_PASSWORD: optional(z.string().default("Admin123!")),
  ADMIN_INITIAL_NAME: optional(z.string().default("System Administrator")),
});

// Rules that depend on more than one variable. They run on the raw values (not the
// schema output) so they are reported even when an unrelated variable is invalid.
function crossFieldProblems(source: NodeJS.ProcessEnv): string[] {
  const read = (name: string) => source[name]?.trim() || undefined;
  const problems: string[] = [];
  const databaseUrl = read("DATABASE_URL");
  const databaseSsl = read("DATABASE_SSL") ?? "require";

  if (!databaseUrl) {
    for (const name of [
      "DB_USERNAME",
      "DB_PASSWORD",
      "DB_HOST",
      "DB_PORT",
      "DB_NAME",
    ]) {
      if (!read(name)) {
        problems.push(`${name}: is required when DATABASE_URL is not set`);
      }
    }
    const dbPort = read("DB_PORT");
    if (dbPort && !port.safeParse(dbPort).success) {
      problems.push("DB_PORT: must be a whole number between 1 and 65535");
    }
  }

  // MikroORM ignores URL query parameters, so `sslmode` here would have no effect.
  if (databaseUrl && /[?&]sslmode=/i.test(databaseUrl)) {
    problems.push(
      "DATABASE_URL: remove `sslmode`; configure TLS with DATABASE_SSL instead",
    );
  }

  // A CA is only used for verification; with any other mode it would be silently ignored.
  if (read("DATABASE_SSL_CA") && databaseSsl !== "verify-full") {
    problems.push(
      `DATABASE_SSL_CA: is only used when DATABASE_SSL=verify-full (current: ${databaseSsl})`,
    );
  }

  return problems;
}

const result = schema.safeParse(process.env);
const problems = [
  ...(result.error?.issues.map(
    (issue) => `${String(issue.path[0] ?? "(root)")}: ${issue.message}`,
  ) ?? []),
  ...crossFieldProblems(process.env),
];

if (!result.success || problems.length > 0) {
  throw new Error(
    `Invalid environment configuration (check your .env):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
  );
}

const parsed = result.data;

export const env = {
  nodeEnv: parsed.NODE_ENV,

  port: parsed.PORT,

  frontendOrigins: parsed.FRONTEND_ORIGINS,

  databaseUrl:
    parsed.DATABASE_URL ??
    `postgresql://${encodeURIComponent(
      parsed.DB_USERNAME ?? "",
    )}:${encodeURIComponent(
      parsed.DB_PASSWORD ?? "",
    )}@${parsed.DB_HOST}:${Number(parsed.DB_PORT)}/${parsed.DB_NAME}`,

  databaseSsl: parsed.DATABASE_SSL,

  databaseSslCa: parsed.DATABASE_SSL_CA,

  jwtSecret: parsed.JWT_SECRET,

  adminInitialEmail: parsed.ADMIN_INITIAL_EMAIL,

  adminInitialPassword: parsed.ADMIN_INITIAL_PASSWORD,

  adminInitialName: parsed.ADMIN_INITIAL_NAME,
} as const;

export const isDevelopment = env.nodeEnv === "development";
