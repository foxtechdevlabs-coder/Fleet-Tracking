// API service layer for Fleet Telemetry & Tracking
// Gracefully handles network states when backend is in development or offline.

import type { Vehicle, TelemetryData, AlertItem, TelemetryEventItem, FleetSummaryMetrics } from '../types/telemetry';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/vehicles`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      // Backend not yet responding or route not mounted
      return [];
    }
    const json = await res.json();
    return Array.isArray(json) ? json : json.data || [];
  } catch {
    // Return empty array when backend is offline
    return [];
  }
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
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/critical`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : json.data || [];
  } catch {
    return [];
  }
}

export async function fetchTelemetryEvents(): Promise<TelemetryEventItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/telemetry/recent`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : json.data || [];
  } catch {
    return [];
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
