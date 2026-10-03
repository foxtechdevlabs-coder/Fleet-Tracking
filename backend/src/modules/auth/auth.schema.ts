// Authentication request validation schemas and rules.
import type { CreateAdminInput } from "../admins/admin.types.js";
import type { LoginCredentials } from "./auth.types.js";

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  data?: T;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates login credential payloads.
 */
export function validateLoginCredentials(
  input: unknown,
): ValidationResult<LoginCredentials> {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: ["Request body must be a valid JSON object"],
    };
  }

  const { email, password } = input as Record<string, unknown>;

  if (typeof email !== "string" || email.trim().length === 0) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push("Invalid email format");
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      email: (email as string).trim().toLowerCase(),
      password: password as string,
    },
  };
}

/**
 * Validates admin creation payloads.
 */
export function validateCreateAdminInput(
  input: unknown,
): ValidationResult<CreateAdminInput> {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: ["Request body must be a valid JSON object"],
    };
  }

  const { email, password, passwordHash, name, role, isActive } =
    input as Record<string, unknown>;

  if (typeof email !== "string" || email.trim().length === 0) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push("Invalid email format");
  }

  if (
    (!password || typeof password !== "string") &&
    (!passwordHash || typeof passwordHash !== "string")
  ) {
    errors.push("Either password or passwordHash must be provided");
  } else if (
    typeof password === "string" &&
    password.length < MIN_PASSWORD_LENGTH
  ) {
    errors.push(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push("Name is required");
  }

  if (role !== undefined && role !== "super_admin" && role !== "admin") {
    errors.push("Role must be either 'super_admin' or 'admin'");
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    errors.push("isActive must be a boolean");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      email: (email as string).trim().toLowerCase(),
      name: (name as string).trim(),
      password: password as string | undefined,
      passwordHash: passwordHash as string | undefined,
      role: role as "super_admin" | "admin" | undefined,
      isActive: isActive as boolean | undefined,
    },
  };
}
