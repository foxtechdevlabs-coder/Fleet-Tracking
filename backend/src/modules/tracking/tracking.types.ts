// Tracking resolution types.
import type { Device } from "../devices/device.entity.js";
import type { Vehicle } from "../vehicles/vehicle.entity.js";

export interface ResolvedTrackingDevice {
  device: Device;
  vehicle: Vehicle;
}
