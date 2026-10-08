// Vehicle API input, output, and status types.
import type { Vehicle } from "./vehicle.entity.js";

export type VehicleStatus = "active" | "inactive" | "maintenance";

/** Existing input type — kept for backward compatibility with controllers/schemas. */
export interface VehicleInput {
  plateNumber: string;
  make?: string;
  model?: string;
  year?: number;
  status?: VehicleStatus;
}

/** Existing partial update type — kept for backward compatibility. */
export type VehicleUpdate = Partial<VehicleInput>;

/** Input for creating a new vehicle via the service layer. */
export interface CreateVehicleInput {
  plateNumber: string;
  make?: string;
  model?: string;
  year?: number;
  status?: VehicleStatus;
}

/** Input for updating an existing vehicle via the service layer. */
export interface UpdateVehicleInput {
  plateNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  status?: VehicleStatus;
}

/** Safe public representation (no internal fields). */
export interface VehicleProfile {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Maps a Vehicle entity to a safe VehicleProfile. */
export function toVehicleProfile(vehicle: Vehicle): VehicleProfile {
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    status: vehicle.status,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}
