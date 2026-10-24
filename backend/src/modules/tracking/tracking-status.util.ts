// Tracking status, speed unit, and timezone conversion utilities.
import { AppError } from "../../common/errors/app-error.js";

export type SpeedUnit = "km/h" | "mph";
export type TrackingStatus = "moving" | "idle" | "stale" | "offline";

export const KMH_TO_MPH_FACTOR = 0.621371;
export const DEFAULT_STALE_THRESHOLD_SECONDS = 300;

/**
 * Validate IANA timezone identifier.
 */
export function isValidTimezone(timezone: string): boolean {
  if (typeof timezone !== "string" || !timezone.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert speed between km/h and mph.
 * Storage is always km/h. When mph is requested, rounded to 2 decimal places.
 */
export function convertSpeed(
  speedKmh: number | null | undefined,
  unit: SpeedUnit = "km/h",
): number | null {
  if (
    speedKmh === null ||
    speedKmh === undefined ||
    !Number.isFinite(speedKmh)
  ) {
    return null;
  }
  if (unit === "mph") {
    return Math.round(speedKmh * KMH_TO_MPH_FACTOR * 100) / 100;
  }
  return speedKmh;
}

/**
 * Choose the primary event timestamp (hardware recorded_at) over server receipt time.
 */
export function getEffectiveTimestamp(reading: {
  recordedAt?: Date | string | null;
  ingestedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): Date | null {
  if (reading.recordedAt) {
    const d = new Date(reading.recordedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (reading.ingestedAt) {
    const d = new Date(reading.ingestedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (reading.createdAt) {
    const d = new Date(reading.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Check if a GPS record is considered stale/offline based on elapsed time.
 */
export function isRecordStale(
  recordedAt: Date | string | null | undefined,
  thresholdSeconds = DEFAULT_STALE_THRESHOLD_SECONDS,
  now = new Date(),
): boolean {
  if (!recordedAt) return true;
  const target = new Date(recordedAt);
  if (Number.isNaN(target.getTime())) return true;
  const elapsedSeconds = (now.getTime() - target.getTime()) / 1000;
  return elapsedSeconds > thresholdSeconds;
}

/**
 * Evaluate vehicle tracking status: moving, idle, or stale/offline.
 * Uses hardware recorded_at timestamp over ingested_at.
 */
export function evaluateTrackingStatus(options: {
  recordedAt?: Date | string | null;
  ingestedAt?: Date | string | null;
  createdAt?: Date | string | null;
  speed?: number | null;
  staleThresholdSeconds?: number;
  now?: Date;
}): TrackingStatus {
  const targetDate = getEffectiveTimestamp(options);
  if (!targetDate) {
    return "offline";
  }

  const now = options.now ?? new Date();
  const elapsedSeconds = (now.getTime() - targetDate.getTime()) / 1000;
  const threshold =
    options.staleThresholdSeconds ?? DEFAULT_STALE_THRESHOLD_SECONDS;

  if (elapsedSeconds > threshold) {
    return "stale";
  }

  const speed = options.speed ?? 0;
  if (speed > 0) {
    return "moving";
  }

  return "idle";
}

/**
 * Format a Date object with the specified IANA timezone while keeping UTC underlying timestamp.
 */
export function formatTimeWithTimezone(
  date: Date | string | null | undefined,
  timezone = "UTC",
): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  if (!isValidTimezone(timezone)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Invalid IANA timezone: ${timezone}`,
    );
  }

  if (timezone === "UTC") {
    return d.toISOString();
  }

  // Format with timezone offset representation
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    fractionalSecondDigits: 3,
  });

  const parts = formatter.formatToParts(d);
  const findPart = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = findPart("year");
  const month = findPart("month");
  const day = findPart("day");
  const hour = findPart("hour");
  const minute = findPart("minute");
  const second = findPart("second");
  const frac = findPart("fractionalSecond");

  // Calculate timezone offset for the given date in the target timezone
  const tzDate = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
  const utcDate = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetDiffMinutes = Math.round(
    (tzDate.getTime() - utcDate.getTime()) / 60000,
  );
  const sign = offsetDiffMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetDiffMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMins = String(absOffset % 60).padStart(2, "0");
  const offsetStr = `${sign}${offsetHours}:${offsetMins}`;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${frac || "000"}${offsetStr}`;
}
