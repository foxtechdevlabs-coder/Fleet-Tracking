// API service layer for Fleet Telemetry & Tracking
// Comprehensive HTTP error handling, stale/offline detection & request optimization

import {
  type Vehicle,
  type FleetSummaryMetrics,
  type ApiErrorDetails,
  type TelemetryData,
  type LastKnownLocation,
  isValidCoordinate,
  calculateFreshness,
} from '../types/telemetry';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Standard HTTP Error with contextual diagnosis and user-friendly guidance
 */
export class ApiHttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly friendlyMessage: string;
  public readonly actionableAdvice: string;
  public readonly canRetry: boolean;

  constructor(status: number, statusText: string, serverMessage?: string) {
    let friendlyMessage = 'An unexpected error occurred while communicating with the tracking service.';
    let actionableAdvice = 'Please try again later or contact your fleet supervisor.';
    let canRetry = true;

    switch (status) {
      case 401:
        friendlyMessage = 'Session expired or unauthorized. Please log in again.';
        actionableAdvice = 'Your operator session has timed out. Re-authenticate to resume live tracking.';
        canRetry = false;
        break;
      case 403:
        friendlyMessage = 'Access denied for this vehicle or telemetry stream.';
        actionableAdvice = 'You do not have clearance to monitor this asset. Contact your system administrator.';
        canRetry = false;
        break;
      case 404:
        friendlyMessage = 'Vehicle or tracking session not found.';
        actionableAdvice = 'The specified vehicle ID does not exist in the fleet registry or has been decommissioned.';
        canRetry = false;
        break;
      case 405:
        friendlyMessage = 'Invalid tracking request method (405 Method Not Allowed).';
        actionableAdvice = 'The telemetry endpoint does not support this HTTP verb. Check client request configuration.';
        canRetry = false;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        friendlyMessage = 'Tracking service temporarily unavailable (500 Server Error).';
        actionableAdvice = 'The telemetry cluster is experiencing high load or undergoing maintenance. Automatic retry is enabled.';
        canRetry = true;
        break;
      default:
        if (serverMessage) {
          friendlyMessage = serverMessage;
        } else if (status >= 500) {
          friendlyMessage = `Tracking server error (${status}). Service unavailable.`;
          canRetry = true;
        } else if (status >= 400) {
          friendlyMessage = `Client request error (${status}).`;
          canRetry = false;
        }
        break;
    }

    super(friendlyMessage);
    this.name = 'ApiHttpError';
    this.status = status;
    this.statusText = statusText;
    this.friendlyMessage = friendlyMessage;
    this.actionableAdvice = actionableAdvice;
    this.canRetry = canRetry;
  }
}

/**
 * Normalizes any caught error into a structured ApiErrorDetails object
 */
export function parseApiError(err: unknown): ApiErrorDetails {
  if (err instanceof ApiHttpError) {
    return {
      status: err.status,
      statusText: err.statusText,
      message: err.message,
      friendlyMessage: err.friendlyMessage,
      actionableAdvice: err.actionableAdvice,
      canRetry: err.canRetry,
      timestamp: new Date().toISOString(),
    };
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return {
      message: 'Request aborted',
      friendlyMessage: 'Tracking request was aborted.',
      actionableAdvice: 'The in-flight request was superseded by a newer action.',
      canRetry: true,
      timestamp: new Date().toISOString(),
    };
  }

  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return {
      status: 0,
      statusText: 'Network Error',
      message: err.message,
      friendlyMessage: 'Network error: Telemetry service unreachable.',
      actionableAdvice: 'Check your internet connection and verify the backend API server is online.',
      canRetry: true,
      timestamp: new Date().toISOString(),
    };
  }

  const raw = err instanceof Error ? err.message : String(err);
  return {
    message: raw,
    friendlyMessage: raw || 'An unknown error occurred while retrieving fleet telemetry.',
    actionableAdvice: 'Please retry or verify server health.',
    canRetry: true,
    timestamp: new Date().toISOString(),
  };
}

interface VehicleApiRecord {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: Vehicle['status'];
  operationalStatus?: Vehicle['operationalStatus'];
  telemetry?: Partial<TelemetryData>;
  lastKnownLocation?: LastKnownLocation;
  createdAt?: string;
  updatedAt?: string;
}

interface VehicleListResponse {
  success: boolean;
  data: VehicleApiRecord[];
  meta: { page: number; limit: number; total: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates and adapts raw API record into a clean Vehicle model.
 * Guarantees zero synthetic fallback coordinates (e.g. [0, 0]) are ever accepted.
 */
export function adaptVehicle(value: unknown, existingVehicle?: Vehicle | null): Vehicle {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.plateNumber !== 'string' ||
    typeof value.make !== 'string' ||
    typeof value.model !== 'string' ||
    typeof value.year !== 'number' ||
    !['active', 'inactive', 'maintenance'].includes(String(value.status))
  ) {
    throw new Error('The vehicle API returned a record with an unsupported shape.');
  }

  let telemetry: TelemetryData | undefined;
  let lastKnownLocation: LastKnownLocation | undefined = existingVehicle?.lastKnownLocation;
  let locationUnavailable = true;

  if (isRecord(value.telemetry)) {
    const rawTelemetry = value.telemetry;
    const lat = typeof rawTelemetry.latitude === 'number' ? rawTelemetry.latitude : undefined;
    const lng = typeof rawTelemetry.longitude === 'number' ? rawTelemetry.longitude : undefined;
    const hasValidCoords = isValidCoordinate(lat, lng);

    const recordedAt = typeof rawTelemetry.recordedAt === 'string'
      ? rawTelemetry.recordedAt
      : typeof rawTelemetry.ingestedAt === 'string'
      ? rawTelemetry.ingestedAt
      : new Date().toISOString();

    const speed = typeof rawTelemetry.speed === 'number' && Number.isFinite(rawTelemetry.speed)
      ? Math.max(0, rawTelemetry.speed)
      : 0;

    const heading = typeof rawTelemetry.heading === 'number' && Number.isFinite(rawTelemetry.heading)
      ? ((Math.round(rawTelemetry.heading) % 360) + 360) % 360
      : 0;

    if (hasValidCoords && lat !== undefined && lng !== undefined) {
      locationUnavailable = false;
      telemetry = {
        latitude: lat,
        longitude: lng,
        speed,
        heading,
        altitude: typeof rawTelemetry.altitude === 'number' ? rawTelemetry.altitude : undefined,
        batteryVoltage: typeof rawTelemetry.batteryVoltage === 'number' ? rawTelemetry.batteryVoltage : undefined,
        fuelPercentage: typeof rawTelemetry.fuelPercentage === 'number' ? rawTelemetry.fuelPercentage : undefined,
        ignition: Boolean(rawTelemetry.ignition),
        engineRpm: typeof rawTelemetry.engineRpm === 'number' ? rawTelemetry.engineRpm : undefined,
        odometerKm: typeof rawTelemetry.odometerKm === 'number' ? rawTelemetry.odometerKm : undefined,
        satelliteCount: typeof rawTelemetry.satelliteCount === 'number' ? rawTelemetry.satelliteCount : undefined,
        recordedAt,
        ingestedAt: typeof rawTelemetry.ingestedAt === 'string' ? rawTelemetry.ingestedAt : recordedAt,
      };

      // Always save or update last known valid position
      lastKnownLocation = {
        latitude: lat,
        longitude: lng,
        recordedAt,
        speed,
        heading,
      };
    } else {
      // Coordinates are missing, NaN, out of bounds, or synthetic [0, 0]
      locationUnavailable = true;
      // Never attach invalid coordinates to telemetry
      telemetry = undefined;
    }
  }

  // Calculate freshness
  const pingTimestamp = telemetry?.recordedAt || telemetry?.ingestedAt || lastKnownLocation?.recordedAt;
  const freshnessInfo = calculateFreshness(pingTimestamp);

  // Derive operational status based on actual data
  let opStatus: Vehicle['operationalStatus'] = 'UNKNOWN';
  if (value.operationalStatus && typeof value.operationalStatus === 'string') {
    opStatus = value.operationalStatus as Vehicle['operationalStatus'];
  } else if (telemetry) {
    if (freshnessInfo.freshness === 'offline') {
      opStatus = 'OFFLINE';
    } else if (telemetry.speed > 0) {
      opStatus = 'MOVING';
    } else {
      opStatus = 'STOPPED';
    }
  }

  return {
    id: value.id,
    plateNumber: value.plateNumber,
    make: value.make,
    model: value.model,
    year: value.year,
    driverName: typeof value.driverName === 'string' ? value.driverName : undefined,
    driverPhone: typeof value.driverPhone === 'string' ? value.driverPhone : undefined,
    deviceId: typeof value.deviceId === 'string' ? value.deviceId : undefined,
    status: value.status as Vehicle['status'],
    operationalStatus: opStatus,
    telemetry,
    lastKnownLocation,
    freshness: freshnessInfo.freshness,
    locationUnavailable,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

/**
 * Fetches all vehicles from backend API with AbortSignal and HTTP error handling
 */
export async function fetchVehicles(signal?: AbortSignal, existingVehicles: Vehicle[] = []): Promise<Vehicle[]> {
  const existingMap = new Map<string, Vehicle>(existingVehicles.map((v) => [v.id, v]));
  const vehicles: Vehicle[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (vehicles.length < total) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/vehicles?page=${page}&limit=100`, {
        headers: { Accept: 'application/json' },
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new ApiHttpError(0, 'Network Error', err instanceof Error ? err.message : undefined);
    }

    if (!response.ok) {
      let serverMessage: string | undefined;
      try {
        const errorPayload: unknown = await response.json();
        if (isRecord(errorPayload) && typeof errorPayload.message === 'string') {
          serverMessage = errorPayload.message;
        }
      } catch {
      }
      throw new ApiHttpError(response.status, response.statusText, serverMessage);
    }

    const payload: unknown = await response.json();
    if (
      !isRecord(payload) ||
      payload.success !== true ||
      !Array.isArray(payload.data) ||
      !isRecord(payload.meta) ||
      !Number.isInteger(payload.meta.total) ||
      (payload.meta.total as number) < 0
    ) {
      throw new Error('The vehicle API returned an unsupported response structure.');
    }

    const responseData = payload as unknown as VehicleListResponse;
    const pageVehicles = responseData.data.map((rec) => adaptVehicle(rec, existingMap.get(rec.id)));
    if (pageVehicles.length === 0 && vehicles.length < responseData.meta.total) {
      throw new Error('The vehicle API returned an incomplete page.');
    }
    vehicles.push(...pageVehicles);
    total = responseData.meta.total;
    page += 1;
  }

  return vehicles;
}

/**
 * Fetches a single vehicle record by ID with AbortSignal and HTTP error handling
 */
export async function fetchVehicleById(
  vehicleId: string,
  signal?: AbortSignal,
  existing?: Vehicle | null
): Promise<Vehicle> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ApiHttpError(0, 'Network Error', err instanceof Error ? err.message : undefined);
  }

  if (!res.ok) {
    let serverMessage: string | undefined;
    try {
      const errPayload = await res.json();
      if (isRecord(errPayload) && typeof errPayload.message === 'string') {
        serverMessage = errPayload.message;
      }
    } catch {
    }
    throw new ApiHttpError(res.status, res.statusText, serverMessage);
  }

  const json = await res.json();
  const rawData = json.data || json;
  return adaptVehicle(rawData, existing);
}

/**
 * Computes high-level fleet operational metrics
 */
export function computeFleetMetrics(vehicles: Vehicle[]): FleetSummaryMetrics {
  const totalPool = vehicles.length;
  const inService = vehicles.filter((v) => v.status === 'active').length;
  const spare = vehicles.filter((v) => v.status === 'inactive').length;

  const activeUnits = vehicles.filter((v) => v.operationalStatus === 'MOVING' || v.operationalStatus === 'STOPPED').length;
  const activePercentage = totalPool > 0 ? Math.round((activeUnits / totalPool) * 100) : 0;

  const movingVehicles = vehicles.filter((v) => v.operationalStatus === 'MOVING');
  const moving = movingVehicles.length;
  const totalSpeed = movingVehicles.reduce((acc, v) => acc + (v.telemetry?.speed || 0), 0);
  const avgSpeed = moving > 0 ? Math.round(totalSpeed / moving) : 0;

  const stopped = vehicles.filter((v) => v.operationalStatus === 'STOPPED').length;
  const offline = vehicles.filter((v) => v.operationalStatus === 'OFFLINE' || v.freshness === 'offline').length;

  return {
    totalPool,
    inService,
    spare,
    activeUnits,
    activePercentage,
    moving,
    avgSpeed,
    stopped,
    offline,
  };
}
