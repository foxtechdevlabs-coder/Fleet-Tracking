// API service layer for Fleet Telemetry & Tracking
// Gracefully handles network states when backend is in development or offline.

import type {
  Vehicle,
  TelemetryData,
  AlertItem,
  TelemetryEventItem,
  FleetSummaryMetrics,
  TrackingReportFilter,
  TrackingReportRecord,
  DeviceSummary,
  ReportVehicleOption,
} from '../types/telemetry';
import { parseFiniteNumber } from '../types/telemetry';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function fetchCollection<T>(path: string, label: string): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Accept': 'application/json' },
    });
  } catch {
    throw new Error(`${label} service could not be reached.`);
  }

  if (!response.ok) {
    throw new Error(`${label} request failed (HTTP ${response.status}).`);
  }

  const body: unknown = await response.json();
  const data = Array.isArray(body)
    ? body
    : typeof body === 'object' && body !== null && 'data' in body && Array.isArray(body.data)
      ? body.data
      : null;
  if (!data) throw new Error(`${label} returned an unsupported response format.`);
  return data as T[];
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const vehicles = await fetchCollection<unknown>('/vehicles', 'Vehicle list');
  return vehicles.map((vehicle, index) => {
    if (typeof vehicle !== 'object' || vehicle === null || Array.isArray(vehicle)) {
      throw new Error(`Vehicle list returned an invalid record at position ${index + 1}.`);
    }

    const value = vehicle as Record<string, unknown>;
    const status = value.status;
    if (
      typeof value.id !== 'string' ||
      typeof value.plateNumber !== 'string' ||
      typeof value.make !== 'string' ||
      typeof value.model !== 'string' ||
      (status !== 'active' && status !== 'inactive' && status !== 'maintenance')
    ) {
      throw new Error(`Vehicle list returned an unsupported record at position ${index + 1}.`);
    }

    const operationalStatuses = ['MOVING', 'STOPPED', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN'] as const;
    const operationalStatus = operationalStatuses.find((status) => status === value.operationalStatus) ?? 'UNKNOWN';
    const optionalString = (field: string): string | undefined => (
      typeof value[field] === 'string' ? value[field] : undefined
    );

    return {
      id: value.id,
      plateNumber: value.plateNumber,
      make: value.make,
      model: value.model,
      year: typeof value.year === 'number' && Number.isFinite(value.year) ? value.year : undefined,
      driverName: optionalString('driverName'),
      driverPhone: optionalString('driverPhone'),
      driverLicense: optionalString('driverLicense'),
      carrierId: optionalString('carrierId'),
      complianceStatus: optionalString('complianceStatus'),
      hardwareModel: optionalString('hardwareModel'),
      imei: optionalString('imei'),
      firmwareVersion: optionalString('firmwareVersion'),
      deviceId: optionalString('deviceId'),
      status,
      operationalStatus,
      createdAt: optionalString('createdAt'),
      updatedAt: optionalString('updatedAt'),
    };
  });
}

export async function fetchVehicleById(vehicleId: string): Promise<Vehicle | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || json;
  } catch {
    return null;
  }
}

export async function fetchLatestTelemetry(vehicleId: string): Promise<TelemetryData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/tracking/latest/${encodeURIComponent(vehicleId)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || json;
  } catch {
    return null;
  }
}

export async function fetchCriticalAlerts(): Promise<AlertItem[]> {
  return fetchCollection<AlertItem>('/alerts/critical', 'Critical alerts');
}

export async function fetchTelemetryEvents(): Promise<TelemetryEventItem[]> {
  return fetchCollection<TelemetryEventItem>('/telemetry/recent', 'Telemetry events');
}

export function computeFleetMetrics(vehicles: Vehicle[]): FleetSummaryMetrics {
  const totalPool = vehicles.length;
  const inService = vehicles.filter(v => v.status === 'active').length;
  const spare = vehicles.filter(v => v.status === 'inactive').length;
  
  const activeUnits = vehicles.filter(v => v.operationalStatus === 'MOVING' || v.operationalStatus === 'STOPPED').length;
  const activePercentage = totalPool > 0 ? Math.round((activeUnits / totalPool) * 100) : 0;
  
  const movingVehicles = vehicles.filter(v => v.operationalStatus === 'MOVING');
  const moving = movingVehicles.length;
  const totalSpeed = movingVehicles.reduce((acc, v) => acc + (v.telemetry?.speed || 0), 0);
  const avgSpeed = moving > 0 ? Math.round(totalSpeed / moving) : 0;
  
  const stopped = vehicles.filter(v => v.operationalStatus === 'STOPPED').length;
  const offline = vehicles.filter(v => v.operationalStatus === 'OFFLINE').length;

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

async function fetchReportCatalog<T>(path: string, label: string): Promise<T[]> {
  const records: T[] = [];
  const limit = 100;
  let page = 1;

  while (true) {
    const response = await fetch(`${API_BASE_URL}${path}?page=${page}&limit=${limit}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      let message = `${label} could not be loaded (HTTP ${response.status}).`;
      try {
        const body: unknown = await response.json();
        if (typeof body === 'object' && body !== null) {
          if ('message' in body && typeof body.message === 'string') message = body.message;
          else if ('error' in body && typeof body.error === 'string') message = body.error;
        }
      } catch {
        // Keep the status-based message when the error response has no JSON body.
      }
      throw new Error(message);
    }

    const body: unknown = await response.json();
    const data = Array.isArray(body)
      ? body
      : typeof body === 'object' && body !== null && 'data' in body && Array.isArray(body.data)
        ? body.data
        : null;
    if (!data) throw new Error(`${label} returned an unsupported response format.`);
    records.push(...(data as T[]));

    const meta = typeof body === 'object' && body !== null && 'meta' in body ? body.meta : null;
    const total = typeof meta === 'object' && meta !== null && 'total' in meta && typeof meta.total === 'number'
      ? meta.total
      : null;
    if (total === null || records.length >= total || data.length === 0) return records;
    page += 1;
  }
}

export async function fetchReportVehicles(): Promise<ReportVehicleOption[]> {
  const vehicles = await fetchReportCatalog<unknown>('/vehicles', 'Vehicle options');
  return vehicles.filter((vehicle): vehicle is ReportVehicleOption => (
    typeof vehicle === 'object' && vehicle !== null &&
    'id' in vehicle && typeof vehicle.id === 'string' &&
    'plateNumber' in vehicle && typeof vehicle.plateNumber === 'string' &&
    'make' in vehicle && typeof vehicle.make === 'string' &&
    'model' in vehicle && typeof vehicle.model === 'string'
  ));
}

export async function fetchDevices(): Promise<DeviceSummary[]> {
  const devices = await fetchReportCatalog<unknown>('/v1/devices', 'Device options');
  return devices.filter((device): device is DeviceSummary => (
    typeof device === 'object' && device !== null &&
    'id' in device && typeof device.id === 'string' &&
    'identifier' in device && typeof device.identifier === 'string' &&
    'status' in device && typeof device.status === 'string' &&
    (!('vehicleId' in device) || typeof device.vehicleId === 'string' || device.vehicleId === null)
  ));
}

export class ReportApiUnavailableError extends Error {}

function normalizeTrackingReportRecords(records: unknown[]): TrackingReportRecord[] {
  return records.map((record, index) => {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new Error(`The report service returned an invalid record at position ${index + 1}.`);
    }

    const value = record as Record<string, unknown>;
    return {
      id: typeof value.id === 'string' ? value.id : undefined,
      recordedAt: typeof value.recordedAt === 'string' ? value.recordedAt : '',
      vehicleId: typeof value.vehicleId === 'string' ? value.vehicleId : undefined,
      plateNumber: typeof value.plateNumber === 'string' ? value.plateNumber : undefined,
      vehicleMake: typeof value.vehicleMake === 'string' ? value.vehicleMake : undefined,
      vehicleModel: typeof value.vehicleModel === 'string' ? value.vehicleModel : undefined,
      deviceId: typeof value.deviceId === 'string' ? value.deviceId : undefined,
      latitude: parseFiniteNumber(value.latitude),
      longitude: parseFiniteNumber(value.longitude),
      speed: parseFiniteNumber(value.speed),
      heading: parseFiniteNumber(value.heading),
      altitude: parseFiniteNumber(value.altitude),
      status: typeof value.status === 'string' ? value.status : undefined,
      ignition: typeof value.ignition === 'boolean' ? value.ignition : undefined,
    };
  });
}

export async function fetchTrackingReport(
  filters: TrackingReportFilter,
  signal?: AbortSignal
): Promise<TrackingReportRecord[]> {
  const params = new URLSearchParams();
  if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);
  if (filters.deviceId) params.append('deviceId', filters.deviceId);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/reports/tracking${queryString ? `?${queryString}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal,
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 501) {
        throw new ReportApiUnavailableError('Historical tracking reports are unavailable: the backend does not expose GET /api/reports/tracking yet.');
      }

      let errorMessage = `HTTP ${res.status}: ${res.statusText || 'Failed to retrieve tracking report'}`;
      try {
        const errJson = await res.json();
        if (errJson.message) errorMessage = errJson.message;
        else if (errJson.error) errorMessage = errJson.error;
      } catch {
        // ignore JSON parse error on error responses
      }
      throw new Error(errorMessage);
    }

    const json: unknown = await res.json();
    if (Array.isArray(json)) return normalizeTrackingReportRecords(json);

    if (typeof json === 'object' && json !== null) {
      if ('success' in json && json.success === false) {
        const message = 'message' in json && typeof json.message === 'string'
          ? json.message
          : 'The report service rejected the request.';
        throw new Error(message);
      }
      if ('data' in json && Array.isArray(json.data)) {
        return normalizeTrackingReportRecords(json.data);
      }
    }

    throw new Error('The report service returned an unsupported response format.');
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof ReportApiUnavailableError) throw error;
    if (error instanceof TypeError) {
      throw new ReportApiUnavailableError('The tracking report service could not be reached. Check the backend connection and try again.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to connect to tracking report service. Please check network connectivity.');
  }
}
