// Tracking service.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import * as deviceRepository from "../devices/device.repository.js";
import * as vehicleRepository from "../vehicles/vehicle.repository.js";
import { parseTrackingDeviceIdentifier } from "./tracking.schema.js";
import type { ResolvedTrackingDevice } from "./tracking.types.js";

export async function resolveTrackingDevice(
  em: EntityManager,
  rawIdentifier: unknown,
): Promise<ResolvedTrackingDevice> {
  const identifier = parseTrackingDeviceIdentifier(rawIdentifier);
  const device = await deviceRepository.findDeviceByIdentifier(em, identifier);

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

  const vehicle = await vehicleRepository.findVehicle(em, device.vehicleId);
  if (!vehicle || vehicle.id !== device.vehicleId) {
    throw new AppError(
      409,
      "DEVICE_VEHICLE_ASSOCIATION_INVALID",
      "Device vehicle association is invalid",
    );
  }

  return { device, vehicle };
}
