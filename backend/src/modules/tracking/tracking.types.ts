// Tracking resolution types.
import type { LocationHistory } from "./location.entity.js";
import type { TrackingLocationInput } from "./tracking.schema.js";

export interface ResolvedTrackingDevice {
  device: { id: string; vehicleId: string | null };
  vehicle: { id: string };
}

export interface TrackingIngestResult {
  location: LocationHistory;
  duplicate: boolean;
}

export type CreateTrackingLocationInput = Omit<
  TrackingLocationInput,
  "deviceIdentifier"
>;
