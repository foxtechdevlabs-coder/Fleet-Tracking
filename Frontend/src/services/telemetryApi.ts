// API service layer for Fleet Telemetry & Tracking
// Gracefully handles network states when backend is in development or offline.

import type { Vehicle, FleetSummaryMetrics } from '../types/telemetry';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface VehicleApiRecord {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: Vehicle['status'];
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

function adaptVehicle(value: unknown): Vehicle {
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

  return {
    id: value.id,
    plateNumber: value.plateNumber,
    make: value.make,
    model: value.model,
    year: value.year,
    status: value.status as Vehicle['status'],
    operationalStatus: 'UNKNOWN',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const vehicles: Vehicle[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (vehicles.length < total) {
    const response = await fetch(`${API_BASE_URL}/vehicles?page=${page}&limit=100`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      let message = `Vehicle API request failed (${response.status}).`;
      try {
        const errorPayload: unknown = await response.json();
        if (isRecord(errorPayload) && typeof errorPayload.message === 'string') {
          message = errorPayload.message;
        }
      } catch {
      }
      throw new Error(message);
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
      throw new Error('The vehicle API returned an unsupported response.');
    }

    const responseData = payload as unknown as VehicleListResponse;
    const pageVehicles = responseData.data.map(adaptVehicle);
    if (pageVehicles.length === 0 && vehicles.length < responseData.meta.total) {
      throw new Error('The vehicle API returned an incomplete page.');
    }
    vehicles.push(...pageVehicles);
    total = responseData.meta.total;
    page += 1;
  }

  return vehicles;
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
