// Device API input, output, and status types.

import type { Vehicle } from "../vehicles/vehicle.entity.js";
import type { VehicleProfile } from "../vehicles/vehicle.types.js";
import type { Device } from "./device.entity.js";

export type DeviceStatus = "active" | "inactive" | "unassigned";

/** Existing input type — kept for backward compatibility with controllers/schemas. */
export interface DeviceInput {
  identifier: string;
  vehicleId?: string | null;
  status?: DeviceStatus;
}

/** Existing partial update type — kept for backward compatibility. */
export type DeviceUpdate = Partial<DeviceInput>;

/** Input for creating a new device via the service layer. */
export interface CreateDeviceInput {
  identifier: string;
  vehicleId?: string | null;
  status?: DeviceStatus;
}

/** Input for updating an existing device via the service layer. */
export interface UpdateDeviceInput {
  vehicleId?: string | null;
  status?: DeviceStatus;
}

/** Safe public representation (no internal fields). */
export interface DeviceProfile {
  id: string;
  identifier: string;
  vehicleId: string | null;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Filter criteria for searching and listing devices with linked vehicles. */
export interface DeviceSearchFilters {
  /** Device identifier (IMEI / serial) or device UUID */
  deviceId?: string;
  /** Alias for deviceId */
  identifier?: string;
  /** Exact vehicle UUID */
  vehicleId?: string;
  /** Vehicle registration / plate number (partial / ILIKE match) */
  registrationNumber?: string;
  /** Alias for registrationNumber */
  plateNumber?: string;
}

/** Safe combined device and vehicle profile for API clients. */
export interface DeviceVehicleProfile {
  id: string;
  identifier: string;
  vehicleId: string | null;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: VehicleProfile | null;
  plateNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
}

/** Maps a Device entity to a safe DeviceProfile. */
export function toDeviceProfile(device: Device): DeviceProfile {
  return {
    id: device.id,
    identifier: device.identifier,
    vehicleId: device.vehicleId,
    status: device.status,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

/** Maps Device and optional Vehicle entities to a safe DeviceVehicleProfile. */
export function toDeviceVehicleProfile(
  device: Device,
  vehicle: Vehicle | null,
): DeviceVehicleProfile {
  const vehicleProfile: VehicleProfile | null = vehicle
    ? {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt,
      }
    : null;

  return {
    id: device.id,
    identifier: device.identifier,
    vehicleId: device.vehicleId,
    status: device.status,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    vehicle: vehicleProfile,
    plateNumber: vehicleProfile?.plateNumber ?? null,
    make: vehicleProfile?.make ?? null,
    model: vehicleProfile?.model ?? null,
    year: vehicleProfile?.year ?? null,
  };
}
