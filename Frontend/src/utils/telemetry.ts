// Formatting helpers for GPS telemetry values.

export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return null;
    }

    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function hasValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  const lat = parseFiniteNumber(latitude);
  const lng = parseFiniteNumber(longitude);
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

const compassDirections = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
];

export function getHeadingCompass(heading?: number | string | null): { degrees: number | null; cardinal: string } {
  const numericHeading = parseFiniteNumber(heading);
  if (numericHeading === null) {
    return { degrees: null, cardinal: "—" };
  }
  const normalized = ((Math.round(numericHeading) % 360) + 360) % 360;
  return {
    degrees: normalized,
    cardinal: compassDirections[Math.round(normalized / 22.5) % 16]
  };
}

export function formatTelemetryTime(dateStr?: string): { relative: string; absolute: string; isStale: boolean } {
  const date = dateStr ? new Date(dateStr) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { relative: "No Handshake", absolute: "—", isStale: false };
  }

  const absolute = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 10) {
    return { relative: "Just now", absolute, isStale: false };
  }

  let relative: string;
  if (diffSec < 60) {
    relative = `${diffSec}s ago`;
  } else if (diffSec < 3600) {
    relative = `${Math.floor(diffSec / 60)}m ago`;
  } else if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    relative = `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  } else {
    const days = Math.floor(diffSec / 86400);
    relative = `${days} day${days > 1 ? "s" : ""} ago`;
  }

  // A fix older than 30 minutes is treated as stale.
  return { relative, absolute, isStale: diffSec >= 1800 };
}
