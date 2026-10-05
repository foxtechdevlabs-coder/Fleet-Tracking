// Device persistence operations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { Device } from "./device.entity.js";
import type {
  CreateDeviceInput,
  DeviceInput,
  DeviceUpdate,
} from "./device.types.js";

export function listDevices(
  em: EntityManager,
  limit: number,
  offset: number,
): Promise<[Device[], number]> {
  return em.findAndCount(
    Device,
    {},
    { orderBy: { createdAt: "DESC" }, limit, offset },
  );
}

export function findDevice(
  em: EntityManager,
  id: string,
): Promise<Device | null> {
  return em.findOne(Device, { id });
}

/** Find a device by its unique identifier (IMEI / serial). */
export function findByIdentifier(
  em: EntityManager,
  identifier: string,
): Promise<Device | null> {
  return em.findOne(Device, { identifier });
}

/** Find the device currently linked to the given vehicle, if any. */
export function findByVehicleId(
  em: EntityManager,
  vehicleId: string,
): Promise<Device | null> {
  return em.findOne(Device, { vehicleId });
}

/** Check whether a device with the given identifier already exists. */
export async function existsByIdentifier(
  em: EntityManager,
  identifier: string,
): Promise<boolean> {
  const count = await em.count(Device, { identifier });
  return count > 0;
}

export async function createDevice(
  em: EntityManager,
  input: DeviceInput | CreateDeviceInput,
): Promise<Device> {
  const now = new Date();
  const device = em.create(Device, {
    ...input,
    vehicleId: input.vehicleId ?? null,
    status: input.status ?? "unassigned",
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  });
  em.persist(device);
  await em.flush();
  return device;
}

export async function updateDevice(
  em: EntityManager,
  device: Device,
  input: DeviceUpdate,
): Promise<Device> {
  em.assign(device, input);
  await em.flush();
  return device;
}

export async function deleteDevice(
  em: EntityManager,
  device: Device,
): Promise<void> {
  em.remove(device);
  await em.flush();
}
