// Device API input and status types.
export type DeviceStatus = "active" | "inactive" | "unassigned";

export interface DeviceInput {
  identifier: string;
  vehicleId?: string | null;
  status?: DeviceStatus;
}

export type DeviceUpdate = Partial<DeviceInput>;
