// Location report types.
import type { LocationHistory } from "../tracking/location.entity.js";
import {
  convertSpeed,
  formatTimeWithTimezone,
  type SpeedUnit,
} from "../tracking/tracking-status.util.js";
import type { LocationReportFilters } from "./report.schema.js";

export interface LocationReportQuery extends LocationReportFilters {
  deviceId?: string;
}

export interface LocationReportRecord {
  recordedAt: Date | string;
  vehicleId: string;
  deviceId: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
}

function validCoordinate(
  value: number | null | undefined,
  minimum: number,
  maximum: number,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

export function toLocationReportRecord(
  location: LocationHistory,
  options?: { speedUnit?: SpeedUnit; timezone?: string },
): LocationReportRecord {
  const speed =
    location.speed !== null && location.speed !== undefined
      ? convertSpeed(location.speed, options?.speedUnit ?? "km/h")
      : null;

  const recordedAt =
    options?.timezone && options.timezone !== "UTC"
      ? (formatTimeWithTimezone(location.recordedAt, options.timezone) ??
        location.recordedAt)
      : location.recordedAt;

  return {
    recordedAt,
    vehicleId: location.vehicleId,
    deviceId: location.deviceId,
    latitude: validCoordinate(location.latitude, -90, 90),
    longitude: validCoordinate(location.longitude, -180, 180),
    speed,
    heading: location.heading ?? null,
    altitude: location.altitude ?? null,
  };
}
