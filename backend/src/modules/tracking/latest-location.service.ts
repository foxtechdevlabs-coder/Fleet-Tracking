// Latest vehicle location service.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import { getEffectiveSettingValue } from "../settings/settings.service.js";
import { LatestLocation } from "./latest-location.entity.js";
import {
  convertSpeed,
  evaluateTrackingStatus,
  formatTimeWithTimezone,
  type SpeedUnit,
  type TrackingStatus,
} from "./tracking-status.util.js";

export interface VehicleLocationStatus {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: Date | string;
  updatedAt: Date | string;
  status: TrackingStatus;
}

/**
 * Format a LatestLocation entity with evaluated tracking status, converted speed, and timezone.
 */
export function toVehicleLocationStatus(
  location: LatestLocation,
  options?: {
    speedUnit?: SpeedUnit;
    timezone?: string;
    staleThresholdSeconds?: number;
    now?: Date;
  },
): VehicleLocationStatus {
  const speed =
    location.speed !== null && location.speed !== undefined
      ? convertSpeed(location.speed, options?.speedUnit ?? "km/h")
      : null;

  const status = evaluateTrackingStatus({
    recordedAt: location.recordedAt,
    speed: location.speed,
    staleThresholdSeconds: options?.staleThresholdSeconds,
    now: options?.now,
  });

  const recordedAt =
    options?.timezone && options.timezone !== "UTC"
      ? (formatTimeWithTimezone(location.recordedAt, options.timezone) ??
        location.recordedAt)
      : location.recordedAt;

  const updatedAt =
    options?.timezone && options.timezone !== "UTC"
      ? (formatTimeWithTimezone(location.updatedAt, options.timezone) ??
        location.updatedAt)
      : location.updatedAt;

  return {
    vehicleId: location.vehicleId,
    latitude: location.latitude,
    longitude: location.longitude,
    speed,
    heading: location.heading,
    recordedAt,
    updatedAt,
    status,
  };
}

/**
 * Get latest location for a specific vehicle with status evaluation.
 */
export async function getLatestLocation(
  em: EntityManager,
  vehicleId: string,
  options?: {
    speedUnit?: SpeedUnit;
    timezone?: string;
    staleThresholdSeconds?: number;
    now?: Date;
  },
): Promise<VehicleLocationStatus> {
  const location = await em.findOne(LatestLocation, { vehicleId });
  if (!location) {
    throw new AppError(
      404,
      "LOCATION_NOT_FOUND",
      "No location recorded for this vehicle",
    );
  }

  let speedUnit = options?.speedUnit;
  let timezone = options?.timezone;
  let staleThreshold = options?.staleThresholdSeconds;

  try {
    if (!speedUnit) {
      speedUnit = await getEffectiveSettingValue<SpeedUnit>(
        em,
        "tracking.speed_unit",
        vehicleId,
      );
    }
    if (!timezone) {
      timezone = await getEffectiveSettingValue<string>(
        em,
        "general.timezone",
        vehicleId,
      );
    }
    if (!staleThreshold) {
      staleThreshold = await getEffectiveSettingValue<number>(
        em,
        "tracking.stale_threshold_seconds",
        vehicleId,
      );
    }
  } catch {
    // In-memory EntityManager in tests may not have Settings mocked
  }

  return toVehicleLocationStatus(location, {
    speedUnit: speedUnit ?? "km/h",
    timezone: timezone ?? "UTC",
    staleThresholdSeconds: staleThreshold,
    now: options?.now,
  });
}

/**
 * List latest locations for all tracked vehicles.
 */
export async function listLatestLocations(
  em: EntityManager,
  options?: {
    speedUnit?: SpeedUnit;
    timezone?: string;
    staleThresholdSeconds?: number;
    now?: Date;
  },
): Promise<VehicleLocationStatus[]> {
  const locations = await em.find(
    LatestLocation,
    {},
    {
      orderBy: { updatedAt: "DESC" },
    },
  );

  return locations.map((loc) =>
    toVehicleLocationStatus(loc, {
      speedUnit: options?.speedUnit ?? "km/h",
      timezone: options?.timezone ?? "UTC",
      staleThresholdSeconds: options?.staleThresholdSeconds,
      now: options?.now,
    }),
  );
}
