// Admin password hashing and signed bearer-token operations.
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { EntityManager } from "@mikro-orm/postgresql";
import { env } from "../../config/env.js";
import { Admin } from "../admins/admin.entity.js";

const scrypt = promisify(scryptCallback);
const tokenLifetimeSeconds = 60 * 60;
const dummyHash = scryptSync(
  "invalid-user-password",
  "vehicle-tracking-dummy-salt",
  64,
).toString("base64url");

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: "super_admin" | "admin";
  jti: string;
  iat: number;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | undefined,
): Promise<boolean> {
  const parts = storedHash?.split("$");
  const validEncoding =
    storedHash !== undefined &&
    storedHash.length <= 128 &&
    parts?.length === 3 &&
    parts[0] === "scrypt" &&
    /^[A-Za-z0-9_-]+$/.test(parts[1]) &&
    /^[A-Za-z0-9_-]+$/.test(parts[2]);
  const decodedSalt = validEncoding
    ? Buffer.from(parts[1], "base64url")
    : Buffer.alloc(0);
  const decodedHash = validEncoding
    ? Buffer.from(parts[2], "base64url")
    : Buffer.alloc(0);
  const validFormat =
    validEncoding && decodedSalt.length === 16 && decodedHash.length === 64;
  const salt = validFormat ? decodedSalt : "vehicle-tracking-dummy-salt";
  const expected = validFormat
    ? decodedHash
    : Buffer.from(dummyHash, "base64url");
  const candidate = (await scrypt(password, salt, expected.length)) as Buffer;

  return (
    validFormat === true &&
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

function signature(value: string): Buffer {
  return createHmac("sha256", env.jwtSecret).update(value).digest();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createAccessToken(
  admin: Pick<Admin, "id" | "email" | "role">,
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; tokenId: string; expiresAt: Date } {
  const claims: AccessTokenClaims = {
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    jti: randomUUID(),
    iat: nowSeconds,
    exp: nowSeconds + tokenLifetimeSeconds,
  };
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const content = `${header}.${payload}`;

  return {
    token: `${content}.${signature(content).toString("base64url")}`,
    tokenId: claims.jti,
    expiresAt: new Date(claims.exp * 1000),
  };
}

export function verifyAccessToken(
  token: string,
): AccessTokenClaims | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;

  try {
    const header: unknown = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    );
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    const actual = Buffer.from(parts[2], "base64url");
    const expected = signature(`${parts[0]}.${parts[1]}`);

    if (
      !isRecord(header) ||
      header.alg !== "HS256" ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected) ||
      !isRecord(payload)
    ) {
      return undefined;
    }

    const { sub, email, role, jti, exp, iat } = payload;
    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      (role !== "admin" && role !== "super_admin") ||
      typeof jti !== "string" ||
      typeof exp !== "number" ||
      !Number.isSafeInteger(exp) ||
      typeof iat !== "number" ||
      !Number.isSafeInteger(iat) ||
      exp <= Math.floor(Date.now() / 1000)
    ) {
      return undefined;
    }

    return { sub, email, role, jti, exp, iat };
  } catch {
    return undefined;
  }
}

export async function authenticateAdmin(
  em: EntityManager,
  email: string,
  password: string,
): Promise<Admin | undefined> {
  const admin = await em.findOne(Admin, { email });
  const passwordMatches = await verifyPassword(password, admin?.passwordHash);
  if (!admin?.isActive || !passwordMatches) {
    return undefined;
  }

  return admin;
}
