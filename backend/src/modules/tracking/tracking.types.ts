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
  /** True when this reading became the vehicle's live position (newer recordedAt). */
  latestUpdated: boolean;
}

export type CreateTrackingLocationInput = Omit<
  TrackingLocationInput,
  "deviceIdentifier"
>;

/** A vehicle's current live position, as served by GET /api/v1/tracking/latest. */
export interface LatestVehicleLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recordedAt: Date;
  updatedAt: Date;
}
