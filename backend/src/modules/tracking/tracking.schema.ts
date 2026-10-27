// Validate normalized tracking input used to resolve registered devices.
import { AppError } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";

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
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request body must be a JSON object",
    );
  }
  return body as Record<string, unknown>;
}

export function parseTrackingDeviceIdentifier(value: unknown): string {
  if (value === undefined || value === null) {
    throw new AppError(400, "VALIDATION_ERROR", "deviceIdentifier is required");
  }
  if (typeof value !== "string") {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "deviceIdentifier must be a string",
    );
  }

  const identifier = value.trim();
  if (identifier.length < 1 || identifier.length > 100) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "deviceIdentifier must be 1-100 characters",
    );
  }

  return identifier;
}

export function parseTrackingTimestamp(value: unknown, field: string): Date {
  if (value === undefined || value === null) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} is required`);
  }
  const invalid = new AppError(
    400,
    "VALIDATION_ERROR",
    `${field} must be an ISO 8601 timestamp with a timezone, e.g. 2026-10-07T05:20:00Z`,
  );
  if (typeof value !== "string" || !value.trim()) {
    throw invalid;
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
    throw invalid;
  }
  return new Date(timestamp);
}

function checkNumber(
  value: unknown,
  field: string,
  min?: number,
  max?: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a number`);
  }
  if (min !== undefined && max !== undefined) {
    if (value < min || value > max) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `${field} must be between ${min} and ${max}`,
      );
    }
  } else if (min !== undefined && value < min) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} must be at least ${min}`,
    );
  }
  return value;
}

function requiredNumber(
  input: Record<string, unknown>,
  field: string,
  min?: number,
  max?: number,
): number {
  const value = input[field];
  if (value === undefined || value === null) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} is required`);
  }
  return checkNumber(value, field, min, max);
}

// Omitted and null both mean "not reported by the device" and are stored as null.
function optionalNumber(
  input: Record<string, unknown>,
  field: string,
  min?: number,
  max?: number,
): number | null {
  const value = input[field];
  if (value === undefined || value === null) return null;
  return checkNumber(value, field, min, max);
}

/**
 * A GPS reading's timestamp: a valid ISO 8601 instant that is not further ahead of the
 * server clock than GPS_MAX_CLOCK_SKEW_SECONDS. A future-dated reading would become
 * the live position and make every correct reading after it look "older", freezing the
 * vehicle's marker. Readings from the past (delayed or out of order) are accepted.
 */
export function parseRecordedAt(value: unknown, now: Date): Date {
  const recordedAt = parseTrackingTimestamp(value, "recordedAt");
  const maxSkewMs = env.gpsMaxClockSkewSeconds * 1000;
  if (recordedAt.getTime() > now.getTime() + maxSkewMs) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `recordedAt must not be more than ${env.gpsMaxClockSkewSeconds} seconds ahead of the server time`,
    );
  }
  return recordedAt;
}

export function parseTrackingLocation(
  body: unknown,
  now: Date = new Date(),
): TrackingLocationInput {
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
    recordedAt: parseRecordedAt(input.recordedAt, now),
    latitude: requiredNumber(input, "latitude", -90, 90),
    longitude: requiredNumber(input, "longitude", -180, 180),
    speed: optionalNumber(input, "speed", 0),
    heading: optionalNumber(input, "heading", 0, 360),
    altitude: optionalNumber(input, "altitude"),
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Maximum vehicle IDs per latest-location query or socket subscription request. */
export const maxVehicleIdsPerRequest = 500;

/**
 * Parses a list of vehicle UUIDs, given as an array or a comma-separated string.
 * Trims, lowercases and de-duplicates. Throws 400 VALIDATION_ERROR on bad input.
 */
export function parseVehicleIdList(value: unknown, field: string): string[] {
  const items =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value) && value.every((item) => typeof item === "string")
        ? (value as string[])
        : undefined;
  if (!items) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} must be a list of vehicle UUIDs`,
    );
  }

  const ids = [
    ...new Set(
      items.map((item) => item.trim().toLowerCase()).filter((item) => item),
    ),
  ];
  if (ids.length === 0 || ids.length > maxVehicleIdsPerRequest) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} must contain 1-${maxVehicleIdsPerRequest} vehicle UUIDs`,
    );
  }
  const invalid = ids.filter((id) => !uuidPattern.test(id));
  if (invalid.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} contains invalid UUID(s): ${invalid.slice(0, 5).join(", ")}`,
    );
  }
  return ids;
}

export interface LatestLocationQuery {
  vehicleIds?: string[];
}

/** Raw entries accepted in a POST body before de-duplication (bounds parsing work). */
export const maxVehicleIdEntriesPerBody = 2 * maxVehicleIdsPerRequest;

/**
 * Body of POST /api/v1/tracking/latest: `{ "vehicleIds": string[] }`, 1-500 unique
 * vehicle UUIDs after trimming, lowercasing and removing duplicates. Unlike the GET
 * query, a comma-separated string is not accepted, and no other keys are allowed.
 */
export function parseLatestLocationBody(body: unknown): {
  vehicleIds: string[];
} {
  const input = objectBody(body);
  const unsupported = Object.keys(input).filter((key) => key !== "vehicleIds");
  if (unsupported.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Unsupported latest-location field(s): ${unsupported.join(", ")}`,
    );
  }
  if (!Array.isArray(input.vehicleIds)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "vehicleIds must be an array of vehicle UUIDs",
    );
  }
  if (input.vehicleIds.length > maxVehicleIdEntriesPerBody) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `vehicleIds must contain at most ${maxVehicleIdEntriesPerBody} entries`,
    );
  }
  return { vehicleIds: parseVehicleIdList(input.vehicleIds, "vehicleIds") };
}

export function parseLatestLocationQuery(
  query: Record<string, unknown>,
): LatestLocationQuery {
  const unsupported = Object.keys(query).filter((key) => key !== "vehicleIds");
  if (unsupported.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Unsupported latest-location filter(s): ${unsupported.join(", ")}`,
    );
  }
  return query.vehicleIds === undefined
    ? {}
    : { vehicleIds: parseVehicleIdList(query.vehicleIds, "vehicleIds") };
}
