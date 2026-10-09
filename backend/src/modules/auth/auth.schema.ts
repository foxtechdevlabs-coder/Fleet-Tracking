// Validate administrator login input.
import { AppError } from "../../common/errors/app-error.js";

export interface LoginInput {
  email: string;
  password: string;
}

export function parseLoginInput(body: unknown): LoginInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "A JSON object is required");
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.email !== "string" ||
    input.email.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
    typeof input.password !== "string" ||
    input.password.length < 1 ||
    input.password.length > 128
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "A valid email and password are required",
    );
  }

  return { email: input.email.trim().toLowerCase(), password: input.password };
}
