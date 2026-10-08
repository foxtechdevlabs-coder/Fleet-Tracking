// Device business rules and not-found handling.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import {
  ConflictError,
  NotFoundError,
} from "../../common/errors/app-errors.js";
import {
  resolveDeviceForVehicle,
  resolveVehicleForDevice,
} from "../tracking/tracking-resolver.service.js";
import { Vehicle } from "../vehicles/vehicle.entity.js";
import * as repository from "./device.repository.js";
import type {
  CreateDeviceInput,
  DeviceInput,
  DeviceSearchFilters,
  DeviceUpdate,
  DeviceVehicleProfile,
} from "./device.types.js";

export const listDevices = repository.listDevices;
export const listDevicesWithVehicles = repository.listDevicesWithVehicles;
export { resolveDeviceForVehicle, resolveVehicleForDevice };

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

/**
 * Create a device after enforcing uniqueness and relationship integrity.
 *
 * Accepts both legacy DeviceInput and the newer CreateDeviceInput.
 *
 * Checks performed (application-level; DB constraints are the final safeguard):
 *  1. identifier must be unique.
 *  2. If vehicleId is provided, the vehicle must exist.
 *  3. If vehicleId is provided, no other device may already be linked to it.
 */
export async function createDevice(
  em: EntityManager,
  input: DeviceInput | CreateDeviceInput,
) {
  // 1. Identifier uniqueness
  if (await repository.existsByIdentifier(em, input.identifier)) {
    throw new ConflictError(
      "A device with this identifier already exists",
      "DEVICE_IDENTIFIER_EXISTS",
    );
  }

  // 2. Vehicle existence
  if (input.vehicleId) {
    const vehicle = await em.findOne(Vehicle, { id: input.vehicleId });
    if (!vehicle) {
      throw new NotFoundError(
        "Assigned vehicle was not found",
        "VEHICLE_NOT_FOUND",
      );
    }

    // 3. Vehicle already linked to another device
    const existing = await repository.findByVehicleId(em, input.vehicleId);
    if (existing) {
      throw new ConflictError(
        "This vehicle is already linked to another device",
        "VEHICLE_ALREADY_LINKED",
      );
    }
  }

  return repository.createDevice(em, input);
}

export async function getDevice(em: EntityManager, id: string) {
  const device = await repository.findDevice(em, id);
  if (!device) {
    throw new NotFoundError("Device was not found", "DEVICE_NOT_FOUND");
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

export class DeviceService {
  constructor(private readonly em: EntityManager) {}

  listDevices(limit: number, offset: number) {
    return repository.listDevices(this.em, limit, offset);
  }

  listDevicesWithVehicles(
    filters?: DeviceSearchFilters,
  ): Promise<DeviceVehicleProfile[]> {
    return repository.listDevicesWithVehicles(this.em, filters);
  }

  getDevice(id: string) {
    return getDevice(this.em, id);
  }

  createDevice(input: DeviceInput | CreateDeviceInput) {
    return createDevice(this.em, input);
  }

  updateDevice(id: string, input: DeviceUpdate) {
    return updateDevice(this.em, id, input);
  }

  deleteDevice(id: string) {
    return deleteDevice(this.em, id);
  }

  resolveDeviceForVehicle(vehicleId: string) {
    return resolveDeviceForVehicle(this.em, vehicleId);
  }

  resolveVehicleForDevice(deviceId: string) {
    return resolveVehicleForDevice(this.em, deviceId);
  }
}
