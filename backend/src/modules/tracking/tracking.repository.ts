// Tracking location persistence operations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { Device } from "../devices/device.entity.js";
import { Vehicle } from "../vehicles/vehicle.entity.js";
import { LatestLocation } from "./latest-location.entity.js";
import { LocationHistory } from "./location.entity.js";
import type { CreateTrackingLocationInput } from "./tracking.types.js";

export function findDeviceForTracking(
  em: EntityManager,
  identifier: string,
): Promise<Pick<Device, "id" | "vehicleId"> | null> {
  return em.findOne(Device, { identifier }, { fields: ["id", "vehicleId"] });
}

export function findVehicleForTracking(
  em: EntityManager,
  vehicleId: string,
): Promise<Pick<Vehicle, "id"> | null> {
  return em.findOne(Vehicle, { id: vehicleId }, { fields: ["id"] });
}

export function findLocationByDeviceTimestamp(
  em: EntityManager,
  deviceId: string,
  recordedAt: Date,
): Promise<LocationHistory | null> {
  return em.findOne(LocationHistory, { deviceId, recordedAt });
}

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
