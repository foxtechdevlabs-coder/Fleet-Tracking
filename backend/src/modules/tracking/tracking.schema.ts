// Validate normalized tracking input used to resolve registered devices.
import { AppError } from "../../common/errors/app-error.js";

export interface TrackingLocationInput {
  deviceIdentifier: string;
  recordedAt: Date;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
}

function objectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "A JSON object is required");
  }
  return body as Record<string, unknown>;
}

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

export function parseTrackingTimestamp(value: unknown, field: string): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} must be a valid ISO 8601 timestamp`,
    );
  }

  const timestampPattern =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/i;
  const timestampParts = timestampPattern.exec(value);
  const timestamp = Date.parse(value);
  const year = Number(timestampParts?.[1]);
  const month = Number(timestampParts?.[2]);
  const day = Number(timestampParts?.[3]);
  const hour = Number(timestampParts?.[4]);
  const minute = Number(timestampParts?.[5]);
  const second = Number(timestampParts?.[6]);
  const offsetHour = Number(timestampParts?.[8] ?? 0);
  const offsetMinute = Number(timestampParts?.[9] ?? 0);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    !Number.isFinite(timestamp) ||
    !timestampParts ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} must be a valid ISO 8601 timestamp`,
    );
  }
  return new Date(timestamp);
}

function finiteNumber(
  input: Record<string, unknown>,
  field: string,
  min?: number,
  max?: number,
): number {
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (min !== undefined && value < min) ||
    (max !== undefined && value > max)
  ) {
    const range =
      min !== undefined && max !== undefined
        ? ` must be between ${min} and ${max}`
        : min !== undefined
          ? ` must be at least ${min}`
          : "";
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field}${range || " must be a finite number"}`,
    );
  }
  return value;
}

function optionalFiniteNumber(
  input: Record<string, unknown>,
  field: string,
  min?: number,
  max?: number,
): number | null {
  if (!Object.hasOwn(input, field)) return null;
  return finiteNumber(input, field, min, max);
}

export function parseTrackingLocation(body: unknown): TrackingLocationInput {
  const input = objectBody(body);
  const allowed = new Set([
    "deviceIdentifier",
    "recordedAt",
    "latitude",
    "longitude",
    "speed",
    "heading",
    "altitude",
  ]);
  const unsupported = Object.keys(input).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Unsupported tracking field(s): ${unsupported.join(", ")}`,
    );
  }

  const deviceIdentifier = parseTrackingDeviceIdentifier(
    input.deviceIdentifier,
  );
  return {
    deviceIdentifier,
    recordedAt: parseTrackingTimestamp(input.recordedAt, "recordedAt"),
    latitude: finiteNumber(input, "latitude", -90, 90),
    longitude: finiteNumber(input, "longitude", -180, 180),
    speed: optionalFiniteNumber(input, "speed", 0),
    heading: optionalFiniteNumber(input, "heading", 0, 360),
    altitude: optionalFiniteNumber(input, "altitude"),
  };
}
