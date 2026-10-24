// Validation schemas and helpers for Settings API.
import { AppError } from "../../common/errors/app-error.js";
import { isValidTimezone } from "../tracking/tracking-status.util.js";
import type {
  SettingInput,
  SettingScope,
  SettingsFilter,
} from "./settings.types.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  "general.timezone": "UTC",
  "general.date_format": "YYYY-MM-DD",
  "general.time_format": "24h",
  "tracking.stale_threshold_seconds": 300,
  "tracking.speed_unit": "km/h",
};

/**
 * Validate setting value according to its specific key rules.
 */
export function validateSettingValue(key: string, value: unknown): unknown {
  if (value === undefined) {
    throw new AppError(400, "VALIDATION_ERROR", "Setting value is required");
  }

  switch (key) {
    case "general.timezone": {
      if (typeof value !== "string" || !isValidTimezone(value)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid IANA timezone identifier for general.timezone",
        );
      }
      return value.trim();
    }
    case "tracking.speed_unit": {
      if (typeof value !== "string" || (value !== "km/h" && value !== "mph")) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid speed unit for tracking.speed_unit. Only 'km/h' and 'mph' are allowed",
        );
      }
      return value;
    }
    case "tracking.stale_threshold_seconds": {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 30 || num > 86400) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "tracking.stale_threshold_seconds must be an integer between 30 and 86400",
        );
      }
      return num;
    }
    case "general.date_format": {
      if (typeof value !== "string" || !value.trim()) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "general.date_format must be a non-empty string",
        );
      }
      return value.trim();
    }
    case "general.time_format": {
      if (typeof value !== "string" || !value.trim()) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "general.time_format must be a non-empty string",
        );
      }
      return value.trim();
    }
    default:
      return value;
  }
}

/**
 * Validate and parse a setting input item.
 */
export function parseSettingInput(raw: unknown): SettingInput {
  if (typeof raw !== "object" || raw === null) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Setting payload must be an object",
    );
  }

  const data = raw as Record<string, unknown>;
  if (typeof data.key !== "string" || !data.key.trim()) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Setting key is required and must be a string",
    );
  }

  const key = data.key.trim();
  const value = validateSettingValue(key, data.value);

  let scope: SettingScope = "global";
  let vehicleId: string | null = null;

  if (data.vehicleId !== undefined && data.vehicleId !== null) {
    if (
      typeof data.vehicleId !== "string" ||
      !uuidPattern.test(data.vehicleId)
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "vehicleId must be a valid UUID",
      );
    }
    vehicleId = data.vehicleId;
    scope = "per_vehicle";
  }

  if (data.scope !== undefined && data.scope !== null) {
    if (data.scope !== "global" && data.scope !== "per_vehicle") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "scope must be either 'global' or 'per_vehicle'",
      );
    }
    scope = data.scope;
    if (scope === "per_vehicle" && !vehicleId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "vehicleId is required when scope is 'per_vehicle'",
      );
    }
    if (scope === "global") {
      vehicleId = null;
    }
  }

  return { key, value, scope, vehicleId };
}

/**
 * Parse batch settings update from body.
 * Supports:
 * 1. Single setting object: { key, value, scope?, vehicleId? }
 * 2. Array of settings in `settings` property: { settings: [ ... ] }
 * 3. Array of settings directly: [ ... ]
 * 4. Key-value dictionary: { "general.timezone": "UTC", ... }
 */
export function parseSettingsBatch(body: unknown): SettingInput[] {
  if (typeof body !== "object" || body === null) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request body must be an object or array",
    );
  }

  if (Array.isArray(body)) {
    if (body.length === 0) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Settings array must not be empty",
      );
    }
    return body.map(parseSettingInput);
  }

  const obj = body as Record<string, unknown>;

  // Check if it has 'key' and 'value'
  if ("key" in obj && "value" in obj) {
    return [parseSettingInput(obj)];
  }

  // Check if it has 'settings' array
  if (Array.isArray(obj.settings)) {
    if (obj.settings.length === 0) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Settings array must not be empty",
      );
    }
    return obj.settings.map(parseSettingInput);
  }

  // Otherwise interpret as dictionary of key -> value
  const results: SettingInput[] = [];
  const vehicleId =
    typeof obj.vehicleId === "string" && uuidPattern.test(obj.vehicleId)
      ? obj.vehicleId
      : null;
  const scope: SettingScope = vehicleId ? "per_vehicle" : "global";

  for (const [key, val] of Object.entries(obj)) {
    if (key === "vehicleId" || key === "scope") continue;
    results.push(parseSettingInput({ key, value: val, scope, vehicleId }));
  }

  if (results.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "No valid settings provided in payload",
    );
  }

  return results;
}

/**
 * Parse query filters for GET /settings.
 */
export function parseSettingsQuery(
  query: Record<string, unknown>,
): SettingsFilter {
  let key: string | undefined;
  let vehicleId: string | null | undefined;
  let scope: SettingScope | undefined;

  if (typeof query.key === "string" && query.key.trim()) {
    key = query.key.trim();
  }

  if (typeof query.vehicleId === "string" && query.vehicleId.trim()) {
    if (!uuidPattern.test(query.vehicleId.trim())) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "vehicleId must be a valid UUID",
      );
    }
    vehicleId = query.vehicleId.trim();
  }

  if (typeof query.scope === "string") {
    if (query.scope !== "global" && query.scope !== "per_vehicle") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "scope must be either 'global' or 'per_vehicle'",
      );
    }
    scope = query.scope;
  }

  return { key, vehicleId, scope };
}
