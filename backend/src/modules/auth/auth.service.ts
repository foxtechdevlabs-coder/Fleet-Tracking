// Authentication service — login verification, credential validation, and JWT token issuance.
import { createHmac, timingSafeEqual } from "node:crypto";
import { verifyPassword } from "../../common/utils/password.util.js";
import { env } from "../../config/env.js";
import type { AdminRepository } from "../admins/admin.repository.js";
import type { AdminProfile } from "../admins/admin.types.js";
import { toAdminProfile } from "../admins/admin.types.js";
import type {
  AdminTokenPayload,
  AuthResponse,
  LoginCredentials,
} from "./auth.types.js";

export interface IAuthService {
  validateCredentials(
    credentials: LoginCredentials,
  ): Promise<AdminProfile | null>;
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  generateToken(
    payload: Omit<AdminTokenPayload, "iat" | "exp">,
    expiresInSeconds?: number,
  ): string;
  verifyToken(token: string): AdminTokenPayload;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

/**
 * Signs a payload as a standard HS256 JWT using Node.js crypto.
 */
export function signJwt(
  payload: object,
  secret: string,
  expiresInSeconds = 86400,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;

  const signature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verifies and decodes a standard HS256 JWT using constant-time comparison.
 */
export function verifyJwt<T = Record<string, unknown>>(
  token: string,
  secret: string,
): T {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const expectedSignature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(signatureB64, "base64url");
  const expSigBuf = Buffer.from(expectedSignature, "base64url");

  if (
    sigBuf.length !== expSigBuf.length ||
    !timingSafeEqual(sigBuf, expSigBuf)
  ) {
    throw new Error("Invalid JWT signature");
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64)) as T & {
    exp?: number;
    iat?: number;
  };

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("JWT token has expired");
  }

  return payload;
}

export class AuthService implements IAuthService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly jwtSecret: string = env.jwtSecret,
    private readonly tokenExpiresInSeconds: number = 86400, // 24 hours
  ) {}

  /**
   * Validates admin login credentials.
   * Returns safe AdminProfile on success, or null on invalid credentials.
   */
  async validateCredentials(
    credentials: LoginCredentials,
  ): Promise<AdminProfile | null> {
    const admin = await this.adminRepository.findByEmail(credentials.email);
    if (!admin?.isActive) {
      return null;
    }

    const isValid = await verifyPassword(
      credentials.password,
      admin.passwordHash,
    );
    if (!isValid) {
      return null;
    }

    return toAdminProfile(admin);
  }

  /**
   * Performs administrator login, returning JWT access token and safe AdminProfile.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const admin = await this.adminRepository.findByEmail(credentials.email);
    if (!admin?.isActive) {
      throw new Error("Invalid email or password");
    }

    const isValid = await verifyPassword(
      credentials.password,
      admin.passwordHash,
    );
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    const tokenPayload: AdminTokenPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = this.generateToken(
      tokenPayload,
      this.tokenExpiresInSeconds,
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.tokenExpiresInSeconds,
      admin: toAdminProfile(admin),
    };
  }

  /**
   * Generates a signed JWT for an administrator.
   */
  generateToken(
    payload: Omit<AdminTokenPayload, "iat" | "exp">,
    expiresInSeconds: number = this.tokenExpiresInSeconds,
  ): string {
    return signJwt(payload, this.jwtSecret, expiresInSeconds);
  }

  /**
   * Verifies and parses a signed JWT.
   */
  verifyToken(token: string): AdminTokenPayload {
    return verifyJwt<AdminTokenPayload>(token, this.jwtSecret);
  }
}
