// Tracking service.
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import * as repository from "./tracking.repository.js";
import {
  parseTrackingDeviceIdentifier,
  type TrackingLocationInput,
} from "./tracking.schema.js";
import type {
  CreateTrackingLocationInput,
  ResolvedTrackingDevice,
  TrackingIngestResult,
} from "./tracking.types.js";

export async function resolveTrackingDevice(
  em: EntityManager,
  rawIdentifier: unknown,
): Promise<ResolvedTrackingDevice> {
  const identifier = parseTrackingDeviceIdentifier(rawIdentifier);
  const device = await repository.findDeviceForTracking(em, identifier);

  if (!device) {
    throw new AppError(
      404,
      "DEVICE_NOT_FOUND",
      "Registered device was not found",
    );
  }

  if (!device.vehicleId) {
    throw new AppError(
      409,
      "DEVICE_NOT_ASSIGNED",
      "Device is not assigned to a vehicle",
    );
  }

  const vehicle = await repository.findVehicleForTracking(em, device.vehicleId);
  if (!vehicle || vehicle.id !== device.vehicleId) {
    throw new AppError(
      409,
      "DEVICE_VEHICLE_ASSOCIATION_INVALID",
      "Device vehicle association is invalid",
    );
  }

  return { device, vehicle };
}

export async function ingestLocation(
  em: EntityManager,
  input: TrackingLocationInput,
): Promise<TrackingIngestResult> {
  let resolvedDeviceId: string | undefined;
  try {
    return await em.transactional(async (transactionalEm) => {
      const { device, vehicle } = await resolveTrackingDevice(
        transactionalEm,
        input.deviceIdentifier,
      );
      resolvedDeviceId = device.id;

      const existing = await repository.findLocationByDeviceTimestamp(
        transactionalEm,
        device.id,
        input.recordedAt,
      );
      if (existing) return { location: existing, duplicate: true };

      const { deviceIdentifier: _deviceIdentifier, ...locationInput } = input;
      const location = await repository.createLocationHistory(
        transactionalEm,
        locationInput satisfies CreateTrackingLocationInput,
        device.id,
        vehicle.id,
      );
      await repository.upsertLatestLocation(
        transactionalEm,
        locationInput,
        vehicle.id,
      );

      return { location, duplicate: false };
    });
  } catch (error) {
    if (
      resolvedDeviceId &&
      (error instanceof UniqueConstraintViolationException ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505"))
    ) {
      const existing = await repository.findLocationByDeviceTimestamp(
        em,
        resolvedDeviceId,
        input.recordedAt,
      );
      if (existing) return { location: existing, duplicate: true };
    }
    throw error;
  }
}
