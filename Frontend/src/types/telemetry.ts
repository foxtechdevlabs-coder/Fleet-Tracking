// Enterprise Telematics & Fleet Tracking Types
// Aligned with FleetTrack Phase 1 Architecture

export type OperationalStatus = 'MOVING' | 'STOPPED' | 'OFFLINE' | 'MAINTENANCE';

export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

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

// Tracking Report interfaces
export interface TrackingReportFilter {
  vehicleId?: string;
  deviceId?: string;
  dateFrom: string; // ISO string or YYYY-MM-DDTHH:mm
  dateTo: string;   // ISO string or YYYY-MM-DDTHH:mm
}

export interface ReportVehicleOption {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
}

export interface TrackingReportRecord {
  id?: string;
  recordedAt: string; // ISO timestamp
  vehicleId?: string;
  plateNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  deviceId?: string;
  latitude: number;
  longitude: number;
  speed?: number | null; // km/h
  heading?: number | null; // degrees (0-360)
  altitude?: number | null; // meters
  status?: string;
  ignition?: boolean;
}

export interface TrackingReportResponse {
  success?: boolean;
  data: TrackingReportRecord[];
  total?: number;
  error?: string;
}

export interface DeviceSummary {
  id: string;
  identifier: string;
  vehicleId?: string | null;
  status: 'active' | 'inactive' | 'unassigned' | string;
}
