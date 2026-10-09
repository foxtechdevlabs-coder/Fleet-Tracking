// Reusable application error classes for common HTTP error scenarios.
import { AppError } from "./app-error.js";

/**
 * Thrown when an operation would violate a uniqueness constraint
 * (e.g. duplicate plate number, duplicate device identifier).
 */
export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT") {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

/**
 * Thrown when a referenced entity does not exist
 * (e.g. assigning a device to a non-existent vehicle).
 */
export class NotFoundError extends AppError {
  constructor(message: string, code = "NOT_FOUND") {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}
