// Validate report query parameters.
import { AppError } from "../../common/errors/app-error.js";
import {
  parseTrackingDeviceIdentifier,
  parseTrackingTimestamp,
} from "../tracking/tracking.schema.js";
import {
  isValidTimezone,
  type SpeedUnit,
} from "../tracking/tracking-status.util.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LocationReportFilters {
  from?: Date;
  to?: Date;
  vehicleId?: string;
  deviceIdentifier?: string;
  timezone?: string;
  speedUnit?: SpeedUnit;
  limit?: number;
  offset?: number;
}

function queryString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", `${name} must be a string`);
  }
  return value.trim();
}

export function parseLocationReportFilters(
  query: Record<string, unknown>,
): LocationReportFilters {
  const allowed = new Set([
    "from",
    "to",
    "vehicleId",
    "deviceIdentifier",
    "timezone",
    "speedUnit",
    "speed_unit",
    "limit",
    "offset",
    "page",
  ]);
  const unsupported = Object.keys(query).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Unsupported report filter(s): ${unsupported.join(", ")}`,
    );
  }

  const fromValue = queryString(query.from, "from");
  const toValue = queryString(query.to, "to");
  const vehicleId = queryString(query.vehicleId, "vehicleId");
  const rawDeviceIdentifier = queryString(
    query.deviceIdentifier,
    "deviceIdentifier",
  );
  const from = fromValue
    ? parseTrackingTimestamp(fromValue, "from")
    : undefined;
  const to = toValue ? parseTrackingTimestamp(toValue, "to") : undefined;
  if (from && to && from > to) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "from must be before or equal to to",
    );
  }
  if (vehicleId && !uuidPattern.test(vehicleId)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "vehicleId must be a valid UUID",
    );
  }

  let timezone: string | undefined;
  const rawTimezone = queryString(query.timezone, "timezone");
  if (rawTimezone) {
    if (!isValidTimezone(rawTimezone)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Invalid IANA timezone: ${rawTimezone}`,
      );
    }
    timezone = rawTimezone;
  }

  let speedUnit: SpeedUnit | undefined;
  const rawSpeedUnit =
    queryString(query.speedUnit, "speedUnit") ??
    queryString(query.speed_unit, "speed_unit");
  if (rawSpeedUnit) {
    if (rawSpeedUnit !== "km/h" && rawSpeedUnit !== "mph") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "speedUnit must be either 'km/h' or 'mph'",
      );
    }
    speedUnit = rawSpeedUnit;
  }

  let limit: number | undefined;
  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 10000
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "limit must be an integer between 1 and 10000",
      );
    }
    limit = parsedLimit;
  }

  let offset: number | undefined;
  if (query.offset !== undefined) {
    const parsedOffset = Number(query.offset);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "offset must be a non-negative integer",
      );
    }
    offset = parsedOffset;
  } else if (query.page !== undefined && limit !== undefined) {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "page must be a positive integer",
      );
    }
    offset = (parsedPage - 1) * limit;
  }

  return {
    from,
    to,
    vehicleId,
    deviceIdentifier: rawDeviceIdentifier
      ? parseTrackingDeviceIdentifier(rawDeviceIdentifier)
      : undefined,
    timezone,
    speedUnit,
    limit,
    offset,
  };
}
