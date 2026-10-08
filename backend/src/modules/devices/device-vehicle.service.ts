// Transactional device + vehicle combined creation.
import { RequestContext } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import { ConflictError } from "../../common/errors/app-errors.js";
import type { Vehicle } from "../vehicles/vehicle.entity.js";
import * as vehicleRepository from "../vehicles/vehicle.repository.js";
import type { CreateVehicleInput } from "../vehicles/vehicle.types.js";
import type { Device } from "./device.entity.js";
import * as deviceRepository from "./device.repository.js";
import type { CreateDeviceInput } from "./device.types.js";

function isEntityManager(val: unknown): val is EntityManager {
  return (
    typeof val === "object" &&
    val !== null &&
    ("transactional" in val ||
      "fork" in val ||
      "findOne" in val ||
      "find" in val ||
      "execute" in val ||
      "getConnection" in val)
  );
}

/**
 * Create a Vehicle and a Device linked to it within a single transaction.
 *
 * The creation is wrapped in `em.transactional()` so that if any step
 * fails, all inserts are rolled back automatically.
 *
 * Uniqueness checks are performed at the application level before persisting:
 *  - Vehicle plate number must be unique.
 *  - Device identifier must be unique.
 *
 * If duplicates are found, throws ConflictError with a clear error message.
 * Optional fields fall back to database defaults or safe defaults without crashing.
 *
 * @param vehicleData Vehicle creation data.
 * @param deviceData Device creation data.
 * @returns The newly created vehicle and device.
 */
export function createDeviceAndVehicle(
  vehicleData: CreateVehicleInput,
  deviceData: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput,
): Promise<{ vehicle: Vehicle; device: Device }>;
export function createDeviceAndVehicle(
  em: EntityManager,
  vehicleData: CreateVehicleInput,
  deviceData: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput,
): Promise<{ vehicle: Vehicle; device: Device }>;
export async function createDeviceAndVehicle(
  emOrVehicleData: EntityManager | CreateVehicleInput,
  vehicleOrDeviceData:
    | CreateVehicleInput
    | (Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput),
  maybeDeviceData?: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput,
): Promise<{ vehicle: Vehicle; device: Device }> {
  let em: EntityManager | undefined;
  let vehicleData: CreateVehicleInput;
  let deviceData: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput;

  if (isEntityManager(emOrVehicleData)) {
    em = emOrVehicleData;
    vehicleData = vehicleOrDeviceData as CreateVehicleInput;
    deviceData = maybeDeviceData as
      | Omit<CreateDeviceInput, "vehicleId">
      | CreateDeviceInput;
  } else {
    em = RequestContext.getEntityManager() as EntityManager | undefined;
    vehicleData = emOrVehicleData;
    deviceData = vehicleOrDeviceData as
      | Omit<CreateDeviceInput, "vehicleId">
      | CreateDeviceInput;
  }

  if (!em) {
    throw new Error(
      "EntityManager must be provided or available in RequestContext",
    );
  }

  if (
    !vehicleData ||
    typeof vehicleData.plateNumber !== "string" ||
    !vehicleData.plateNumber.trim()
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Vehicle plateNumber is required",
    );
  }

  if (
    !deviceData ||
    typeof deviceData.identifier !== "string" ||
    !deviceData.identifier.trim()
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Device identifier is required",
    );
  }

  const normalizedPlate = vehicleData.plateNumber.trim();
  const normalizedIdentifier = deviceData.identifier.trim();

  return em.transactional(async (txEm) => {
    // 1. Verify Vehicle plate number uniqueness
    if (await vehicleRepository.existsByPlateNumber(txEm, normalizedPlate)) {
      throw new ConflictError(
        `Vehicle with plate number '${normalizedPlate}' already exists`,
        "PLATE_NUMBER_EXISTS",
      );
    }

    // 2. Verify Device identifier uniqueness
    if (await deviceRepository.existsByIdentifier(txEm, normalizedIdentifier)) {
      throw new ConflictError(
        `A device with identifier '${normalizedIdentifier}' already exists`,
        "DEVICE_IDENTIFIER_EXISTS",
      );
    }

    // 3. Save the Vehicle first
    const vehicle = await vehicleRepository.createVehicle(txEm, {
      ...vehicleData,
      plateNumber: normalizedPlate,
    });

    // 4. Extract its id and assign to the Device's vehicleId before saving the Device
    const device = await deviceRepository.createDevice(txEm, {
      ...deviceData,
      identifier: normalizedIdentifier,
      vehicleId: vehicle.id,
      status: deviceData.status ?? "active",
    });

    return { vehicle, device };
  });
}

/** Alias for backward compatibility */
export const createDeviceWithVehicle = createDeviceAndVehicle;

export class DeviceVehicleService {
  constructor(private readonly em: EntityManager) {}

  createDeviceAndVehicle(
    vehicleData: CreateVehicleInput,
    deviceData: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput,
  ): Promise<{ vehicle: Vehicle; device: Device }> {
    return createDeviceAndVehicle(this.em, vehicleData, deviceData);
  }

  createDeviceWithVehicle(
    vehicleData: CreateVehicleInput,
    deviceData: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput,
  ): Promise<{ vehicle: Vehicle; device: Device }> {
    return createDeviceAndVehicle(this.em, vehicleData, deviceData);
  }
}
