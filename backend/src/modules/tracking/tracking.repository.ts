// Tracking location persistence operations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { Device } from "../devices/device.entity.js";
import { Vehicle } from "../vehicles/vehicle.entity.js";
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
): Promise<void> {
  await em.getConnection().execute(
    `INSERT INTO "latest_locations"
      ("vehicle_id", "latitude", "longitude", "speed", "heading", "recorded_at")
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT ("vehicle_id") DO UPDATE SET
       "latitude" = EXCLUDED."latitude",
       "longitude" = EXCLUDED."longitude",
       "speed" = EXCLUDED."speed",
       "heading" = EXCLUDED."heading",
       "recorded_at" = EXCLUDED."recorded_at",
       "updated_at" = NOW()
     WHERE "latest_locations"."recorded_at" < EXCLUDED."recorded_at"`,
    [
      vehicleId,
      input.latitude,
      input.longitude,
      input.speed,
      input.heading,
      input.recordedAt,
    ],
  );
}
