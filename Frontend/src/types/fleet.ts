// Shapes of the data exchanged with the FleetTrack backend API.

export interface Admin {
  email: string;
  name: string;
  role: string;
}

export interface Session {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: number;
  admin: Admin;
}

/** The part of a session needed to authorize an API request. */
export type Credentials = Pick<Session, "accessToken" | "tokenType">;

export interface DeviceRecord {
  id: string;
  identifier: string;
  status: string;
  vehicleId?: string | null;
  updatedAt?: string;
}

export interface VehicleRecord {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year?: number;
  status: string;
  updatedAt?: string;
}

export interface DevicePayload {
  identifier: string;
  status: string;
}

export interface VehiclePayload {
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status?: string;
}

export type TrackingStatus = "moving" | "idle" | "stale" | "offline";

export interface LatestLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  updatedAt?: string;
  status?: TrackingStatus;
}

export interface IngestPayload {
  deviceIdentifier: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

export type SpeedUnit = "km/h" | "mph";

export interface LocationReportFilters {
  from?: string;
  to?: string;
  vehicleId?: string;
  deviceIdentifier?: string;
  timezone?: string;
  speedUnit?: SpeedUnit;
  limit?: string | number;
  offset?: string | number;
}

export interface LocationReportRecord {
  recordedAt: string;
  vehicleId: string;
  deviceId: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
}
