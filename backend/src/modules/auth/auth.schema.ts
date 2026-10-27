// Validate administrator login input.
import { AppError } from "../../common/errors/app-error.js";

export interface LoginInput {
  email: string;
  password: string;
}

function invalid(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message);
}

export function parseLoginInput(body: unknown): LoginInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw invalid("Request body must be a JSON object");
  }

  const input = body as Record<string, unknown>;
  if (input.email === undefined || input.email === null) {
    throw invalid("email is required");
  }
  if (
    typeof input.email !== "string" ||
    input.email.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
  ) {
    throw invalid("email must be a valid email address");
  }
  if (
    input.password === undefined ||
    input.password === null ||
    input.password === ""
  ) {
    throw invalid("password is required");
  }
  if (typeof input.password !== "string") {
    throw invalid("password must be a string");
  }
  if (input.password.length > 128) {
    throw invalid("password must be at most 128 characters");
  }

  return { email: input.email.trim().toLowerCase(), password: input.password };
}
