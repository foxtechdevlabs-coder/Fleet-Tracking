// Vehicle API input and status types.
export type VehicleStatus = "active" | "inactive" | "maintenance";

export interface VehicleInput {
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  status?: VehicleStatus;
}

export type VehicleUpdate = Partial<VehicleInput>;
