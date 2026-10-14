// Validate report query parameters.
import { AppError } from "../../common/errors/app-error.js";
import {
  parseTrackingDeviceIdentifier,
  parseTrackingTimestamp,
} from "../tracking/tracking.schema.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LocationReportFilters {
  from?: Date;
  to?: Date;
  vehicleId?: string;
  deviceIdentifier?: string;
}

function queryString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", `${name} must be a string`);
  }
  return value;
}

export function parseLocationReportFilters(
  query: Record<string, unknown>,
): LocationReportFilters {
  const allowed = new Set(["from", "to", "vehicleId", "deviceIdentifier"]);
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

  return {
    from,
    to,
    vehicleId,
    deviceIdentifier: rawDeviceIdentifier
      ? parseTrackingDeviceIdentifier(rawDeviceIdentifier)
      : undefined,
  };
}
