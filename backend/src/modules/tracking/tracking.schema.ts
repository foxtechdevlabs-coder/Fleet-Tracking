// Validate normalized tracking input used to resolve registered devices.
import { AppError } from "../../common/errors/app-error.js";

export function parseTrackingDeviceIdentifier(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Device identifier must be a string",
    );
  }

  const identifier = value.trim();
  if (identifier.length < 1 || identifier.length > 100) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Device identifier must be 1-100 characters",
    );
  }

  return identifier;
}
