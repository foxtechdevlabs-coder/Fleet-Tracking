// Device business rules and not-found handling.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import { Vehicle } from "../vehicles/vehicle.entity.js";
import * as repository from "./device.repository.js";
import type { DeviceInput, DeviceUpdate } from "./device.types.js";

export const listDevices = repository.listDevices;

async function validateVehicle(
  em: EntityManager,
  vehicleId: string | null | undefined,
): Promise<void> {
  if (vehicleId && !(await em.findOne(Vehicle, { id: vehicleId }))) {
    throw new AppError(
      404,
      "VEHICLE_NOT_FOUND",
      "Assigned vehicle was not found",
    );
  }
}

export async function createDevice(em: EntityManager, input: DeviceInput) {
  await validateVehicle(em, input.vehicleId);
  return repository.createDevice(em, input);
}

export async function getDevice(em: EntityManager, id: string) {
  const device = await repository.findDevice(em, id);
  if (!device) {
    throw new AppError(404, "DEVICE_NOT_FOUND", "Device was not found");
  }
  return device;
}

export async function updateDevice(
  em: EntityManager,
  id: string,
  input: DeviceUpdate,
) {
  await validateVehicle(em, input.vehicleId);
  return repository.updateDevice(em, await getDevice(em, id), input);
}

export async function deleteDevice(em: EntityManager, id: string) {
  await repository.deleteDevice(em, await getDevice(em, id));
}
