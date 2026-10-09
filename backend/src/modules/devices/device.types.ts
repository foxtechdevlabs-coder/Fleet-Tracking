// Device API input, output, and status types.
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
  vehicleId?: string;
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
