// Tracking location persistence operations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { LatestLocation } from "./latest-location.entity.js";
import { LocationHistory } from "./location.entity.js";
import type { CreateTrackingLocationInput } from "./tracking.types.js";

export async function createLocationHistory(
  em: EntityManager,
  input: CreateTrackingLocationInput,
  deviceId: string,
  vehicleId: string,
): Promise<LocationHistory> {
  const location = em.create(LocationHistory, {
    ...input,
    deviceId,
    vehicleId,
    ingestedAt: new Date(),
  });
  em.persist(location);
  await em.flush();
  return location;
}

export async function upsertLatestLocation(
  em: EntityManager,
  input: CreateTrackingLocationInput,
  vehicleId: string,
): Promise<LatestLocation> {
  return em.upsert(
    LatestLocation,
    {
      vehicleId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed: input.speed,
      heading: input.heading,
      updatedAt: new Date(),
    },
    { onConflictFields: ["vehicleId"], onConflictAction: "merge" },
  );
}
