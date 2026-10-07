// Tracking resolution types.
import type { Device } from "../devices/device.entity.js";
import type { Vehicle } from "../vehicles/vehicle.entity.js";
import type { LocationHistory } from "./location.entity.js";
import type { TrackingLocationInput } from "./tracking.schema.js";

export interface ResolvedTrackingDevice {
  device: Device;
  vehicle: Vehicle;
}

export interface PersistedTrackingLocation {
  location: LocationHistory;
  device: Device;
  vehicle: Vehicle;
}

export type CreateTrackingLocationInput = Omit<
  TrackingLocationInput,
  "deviceIdentifier"
>;
