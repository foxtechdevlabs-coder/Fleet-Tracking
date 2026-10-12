// Enterprise Telematics & Fleet Tracking Types
// Aligned with FleetTrack Phase 1 Architecture

export type OperationalStatus = 'MOVING' | 'STOPPED' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';

export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

/**
 * Tracking freshness state based on last telemetry ping timestamp
 */
export type TrackingFreshness = 'live' | 'stale' | 'offline' | 'unknown';

/**
 * Tracking API state machine states
 */
export type ApiState = 'idle' | 'loading' | 'success' | 'error' | 'retrying';

export interface FreshnessConfig {
  staleThresholdMs: number; // e.g. 5 minutes (300,000 ms)
  offlineThresholdMs: number; // e.g. 15 minutes (900,000 ms)
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  staleThresholdMs: 5 * 60 * 1000, // 5 minutes
  offlineThresholdMs: 15 * 60 * 1000, // 15 minutes
};

export interface LastKnownLocation {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speed?: number;
  heading?: number;
}

export interface ApiErrorDetails {
  status?: number;
  statusText?: string;
  message: string;
  friendlyMessage: string;
  actionableAdvice?: string;
  canRetry: boolean;
  timestamp: string;
}

export interface TelemetryData {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number; // degrees (0-360)
  altitude?: number; // meters
  batteryVoltage?: number; // volts (e.g., 12.6V, 24.2V)
  fuelPercentage?: number; // 0 - 100%
  ignition: boolean;
  engineRpm?: number;
  odometerKm?: number;
  satelliteCount?: number;
  recordedAt: string; // ISO string or timestamp
  ingestedAt: string; // ISO string
}

export interface Vehicle {
  id: string; // Internal identifier (e.g. "VH-101" or UUID)
  plateNumber: string; // Formatted plate (e.g. "TN 74 AB 1234")
  make: string;
  model: string;
  year: number;
  driverName?: string;
  driverPhone?: string;
  deviceId?: string;
  status: VehicleStatus;
  operationalStatus: OperationalStatus;
  telemetry?: TelemetryData;
  lastKnownLocation?: LastKnownLocation;
  freshness?: TrackingFreshness;
  locationUnavailable?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertItem {
  id: string;
  vehicleId: string;
  plateNumber?: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  acknowledged: boolean;
}

export interface TelemetryEventItem {
  id: string;
  vehicleId: string;
  deviceId?: string;
  eventType: 'ignition_on' | 'ignition_off' | 'gps_ping' | 'overspeed' | 'fuel_drop' | 'harsh_brake' | 'geofence_entry' | 'geofence_exit' | string;
  summary: string;
  recordedAt: string;
  ingestedAt: string;
  payload?: Record<string, unknown>;
}

export interface FleetSummaryMetrics {
  totalPool: number;
  inService: number;
  spare: number;
  activeUnits: number;
  activePercentage: number;
  moving: number;
  avgSpeed: number;
  stopped: number;
  offline: number;
}

export interface TableColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

export type MapViewMode = 'street' | 'satellite' | 'traffic';

/**
 * Checks whether coordinates represent a genuine, physically valid WGS84 position.
 * Rejects null, undefined, NaN, non-finite values, out-of-range degrees,
 * and synthetic default [0, 0] (Null Island) values.
 */
export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }
  // Disallow exact [0, 0] to eliminate synthetic mock/fallback plots
  if (lat === 0 && lng === 0) {
    return false;
  }
  return true;
}

/**
 * Determines tracking freshness category and metadata given a timestamp.
 */
export function calculateFreshness(
  timestamp?: string | number | Date | null,
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG
): {
  freshness: TrackingFreshness;
  label: string;
  badgeClass: string;
  dotClass: string;
  subtext: string;
  elapsedMs: number | null;
} {
  if (!timestamp) {
    return {
      freshness: 'unknown',
      label: 'No Data',
      badgeClass: 'freshness-unknown',
      dotClass: 'dot-unknown',
      subtext: 'Awaiting telemetry fix',
      elapsedMs: null,
    };
  }

  const date = new Date(timestamp);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return {
      freshness: 'unknown',
      label: 'Invalid Time',
      badgeClass: 'freshness-unknown',
      dotClass: 'dot-unknown',
      subtext: 'Invalid timestamp',
      elapsedMs: null,
    };
  }

  const now = Date.now();
  const elapsedMs = Math.max(0, now - time);

  if (elapsedMs < config.staleThresholdMs) {
    return {
      freshness: 'live',
      label: 'Live (Active)',
      badgeClass: 'freshness-live',
      dotClass: 'dot-live',
      subtext: 'Streaming real-time coordinates',
      elapsedMs,
    };
  }

  if (elapsedMs < config.offlineThresholdMs) {
    const mins = Math.max(1, Math.floor(elapsedMs / (60 * 1000)));
    return {
      freshness: 'stale',
      label: 'Stale',
      badgeClass: 'freshness-stale',
      dotClass: 'dot-stale',
      subtext: `Telemetry delayed by ${mins}m`,
      elapsedMs,
    };
  }

  const mins = Math.floor(elapsedMs / (60 * 1000));
  const hrs = Math.floor(mins / 60);
  const timeDisplay = hrs > 0 ? `${hrs}h+` : `${mins}m+`;
  return {
    freshness: 'offline',
    label: 'Offline',
    badgeClass: 'freshness-offline',
    dotClass: 'dot-offline',
    subtext: `Telemetry offline for ${timeDisplay}`,
    elapsedMs,
  };
}
