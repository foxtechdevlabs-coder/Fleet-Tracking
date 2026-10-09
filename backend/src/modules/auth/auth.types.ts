// Authentication types, JWT payload contracts, and credentials.
import type { AdminProfile, AdminRole } from "../admins/admin.types.js";

/** JWT payload contract for authenticated administrators */
export interface AdminTokenPayload {
  sub: string; // admin ID (UUID)
  email: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

export type TokenPayload = AdminTokenPayload;
export type AdminJwtPayload = AdminTokenPayload;

/** Login credentials supplied during authentication */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Successful authentication response structure */
export interface AuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  admin: AdminProfile;
}

export type LoginResult = AuthResponse;
