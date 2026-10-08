// Tracking resolver service — attribute telemetry to devices and vehicles.
import { RequestContext } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { NotFoundError } from "../../common/errors/app-errors.js";
import type { Device } from "../devices/device.entity.js";
import * as deviceRepository from "../devices/device.repository.js";
import type { Vehicle } from "../vehicles/vehicle.entity.js";
import * as vehicleRepository from "../vehicles/vehicle.repository.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isEntityManager(val: unknown): val is EntityManager {
  return (
    typeof val === "object" &&
    val !== null &&
    ("find" in val ||
      "findOne" in val ||
      "fork" in val ||
      "getConnection" in val ||
      "execute" in val ||
      "transactional" in val)
  );
}

/**
 * Resolve the Device assigned to a given Vehicle.
 * Throws NotFoundError if the vehicle does not exist or has no assigned device.
 *
 * @param vehicleId The unique UUID of the vehicle.
 * @returns The assigned Device entity.
 */
export function resolveDeviceForVehicle(vehicleId: string): Promise<Device>;
export function resolveDeviceForVehicle(
  em: EntityManager,
  vehicleId: string,
): Promise<Device>;
export async function resolveDeviceForVehicle(
  emOrVehicleId: EntityManager | string,
  maybeVehicleId?: string,
): Promise<Device> {
  let em: EntityManager | undefined;
  let vehicleId: string;

  if (isEntityManager(emOrVehicleId)) {
    em = emOrVehicleId;
    vehicleId = (maybeVehicleId ?? "") as string;
  } else {
    em = RequestContext.getEntityManager() as EntityManager | undefined;
    vehicleId = emOrVehicleId;
  }

  if (!em) {
    throw new Error(
      "EntityManager must be provided or available in RequestContext",
    );
  }

  if (!vehicleId || typeof vehicleId !== "string" || !vehicleId.trim()) {
    throw new NotFoundError("Vehicle was not found", "VEHICLE_NOT_FOUND");
  }

  const cleanVehicleId = vehicleId.trim();

  // 1. Verify the vehicle exists
  const vehicle = await vehicleRepository.findVehicle(em, cleanVehicleId);
  if (!vehicle) {
    throw new NotFoundError(
      `Vehicle '${cleanVehicleId}' was not found`,
      "VEHICLE_NOT_FOUND",
    );
  }

  // 2. Fetch the device linked to this vehicle
  const device = await deviceRepository.findByVehicleId(em, cleanVehicleId);
  if (!device) {
    throw new NotFoundError(
      `No device is currently assigned to vehicle '${cleanVehicleId}'`,
      "DEVICE_NOT_FOUND",
    );
  }

  return device;
}

/**
 * Resolve the Vehicle assigned to a given Device (by device UUID or identifier/IMEI).
 * Throws NotFoundError if the device is not found, unassigned, or the vehicle is missing.
 *
 * @param deviceId Device UUID or unique identifier string.
 * @returns The assigned Vehicle entity.
 */
export function resolveVehicleForDevice(deviceId: string): Promise<Vehicle>;
export function resolveVehicleForDevice(
  em: EntityManager,
  deviceId: string,
): Promise<Vehicle>;
export async function resolveVehicleForDevice(
  emOrDeviceId: EntityManager | string,
  maybeDeviceId?: string,
): Promise<Vehicle> {
  let em: EntityManager | undefined;
  let deviceId: string;

  if (isEntityManager(emOrDeviceId)) {
    em = emOrDeviceId;
    deviceId = (maybeDeviceId ?? "") as string;
  } else {
    em = RequestContext.getEntityManager() as EntityManager | undefined;
    deviceId = emOrDeviceId;
  }

  if (!em) {
    throw new Error(
      "EntityManager must be provided or available in RequestContext",
    );
  }

  if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
    throw new NotFoundError("Device was not found", "DEVICE_NOT_FOUND");
  }

  const cleanDeviceId = deviceId.trim();

  // 1. Fetch the device by UUID or by identifier
  let device: Device | null = null;
  if (uuidPattern.test(cleanDeviceId)) {
    device = await deviceRepository.findDevice(em, cleanDeviceId);
  }
  if (!device) {
    device = await deviceRepository.findByIdentifier(em, cleanDeviceId);
  }
  if (!device) {
    throw new NotFoundError(
      `Device '${cleanDeviceId}' was not found`,
      "DEVICE_NOT_FOUND",
    );
  }

  // 2. Ensure the device has an assigned vehicleId
  if (!device.vehicleId) {
    throw new NotFoundError(
      `Device '${device.identifier}' is not assigned to any vehicle`,
      "VEHICLE_NOT_FOUND",
    );
  }

  // 3. Fetch the assigned vehicle
  const vehicle = await vehicleRepository.findVehicle(em, device.vehicleId);
  if (!vehicle) {
    throw new NotFoundError(
      `Vehicle assigned to device '${device.identifier}' was not found`,
      "VEHICLE_NOT_FOUND",
    );
  }

  return vehicle;
}

export class TrackingResolverService {
  constructor(private readonly em?: EntityManager) {}

  resolveDeviceForVehicle(vehicleId: string): Promise<Device> {
    return this.em
      ? resolveDeviceForVehicle(this.em, vehicleId)
      : resolveDeviceForVehicle(vehicleId);
  }

  resolveVehicleForDevice(deviceId: string): Promise<Vehicle> {
    return this.em
      ? resolveVehicleForDevice(this.em, deviceId)
      : resolveVehicleForDevice(deviceId);
  }
}
