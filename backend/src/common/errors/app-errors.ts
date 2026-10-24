// Reusable application error classes for common HTTP error scenarios.
import { AppError } from "./app-error.js";

/**
 * Thrown when input data is missing or invalid at the service layer,
 * before any DB operation is attempted.
 *
 * Extends AppError so the global error handler serialises it via
 * `error.status` (422) and `error.code` ("VALIDATION_ERROR").
 */
export class ValidationError extends AppError {
  /** The name of the field that failed validation. */
  public readonly field: string;

  constructor(field: string, message: string) {
    super(422, "VALIDATION_ERROR", message);
    this.name = "ValidationError";
    this.field = field;
  }
}

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
