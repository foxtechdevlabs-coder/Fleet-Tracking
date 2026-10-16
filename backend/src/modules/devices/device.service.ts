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

async function ensureIdentifierAvailable(
  em: EntityManager,
  identifier: string,
): Promise<void> {
  if (await repository.existsByIdentifier(em, identifier)) {
    throw new ConflictError(
      "Device identifier already exists",
      "DEVICE_IDENTIFIER_EXISTS",
    );
  }
}

export async function createDevice(em: EntityManager, input: DeviceInput) {
  await ensureIdentifierAvailable(em, input.identifier);
  await validateVehicle(em, input.vehicleId);
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
