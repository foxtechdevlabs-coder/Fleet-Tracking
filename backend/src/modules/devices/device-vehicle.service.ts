// Transactional device + vehicle combined creation.
import { RequestContext } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  ConflictError,
  ValidationError,
} from "../../common/errors/app-errors.js";
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
 * Validate all required vehicle fields at the service layer.
 * Throws ValidationError (422) with a field-level message for the first
 * missing or blank field found — before any DB operation begins.
 */
function validateVehicleInput(data: CreateVehicleInput): void {
  if (typeof data.plateNumber !== "string" || !data.plateNumber.trim()) {
    throw new ValidationError("plateNumber", "Vehicle plateNumber is required");
  }
  if (typeof data.make !== "string" || !data.make.trim()) {
    throw new ValidationError("make", "Vehicle make is required");
  }
  if (typeof data.model !== "string" || !data.model.trim()) {
    throw new ValidationError("model", "Vehicle model is required");
  }
  if (data.year == null || !Number.isInteger(data.year) || data.year < 1900) {
    throw new ValidationError(
      "year",
      "Vehicle year is required and must be a valid integer >= 1900",
    );
  }
}

/**
 * Validate all required device fields at the service layer.
 * Throws ValidationError (422) with a field-level message for the first
 * missing or blank field found — before any DB operation begins.
 */
function validateDeviceInput(
  data: Omit<CreateDeviceInput, "vehicleId"> | CreateDeviceInput,
): void {
  if (typeof data.identifier !== "string" || !data.identifier.trim()) {
    throw new ValidationError("identifier", "Device identifier is required");
  }
}

/**
 * Create a Vehicle and a Device linked to it within a single transaction.
 *
 * ### Validation (before any DB operation)
 * Required vehicle fields: `plateNumber`, `make`, `model`, `year`.
 * Required device fields: `identifier`.
 * Missing or blank values throw ValidationError (422) with a field-level message.
 *
 * ### Uniqueness (before the transaction opens)
 * - `device.identifier` must be unique across the `devices` table.
 * - `vehicle.plateNumber` must be unique across the `vehicles` table.
 * Duplicates throw ConflictError (409) before any write occurs.
 *
 * ### Transaction & rollback guarantee
 * All DB writes are wrapped in `em.transactional()`. MikroORM runs every
 * statement inside a BEGIN ... COMMIT block; if any step throws (including
 * a custom error), the driver issues an automatic ROLLBACK, so partial
 * records can never be committed to the database.
 *
 * Optional fields (`vehicleId`, `status`, `lastSeenAt`) fall back to DB
 * defaults (`null` / `"active"` / `null`) without crashing.
 *
 * @param vehicleData Vehicle creation data.
 * @param deviceData Device creation data (vehicleId is assigned from the new vehicle).
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

  // -- 1. Field-level validation — runs BEFORE any DB operation -------------
  // Throws ValidationError (422) with a clear field name so the HTTP layer
  // can surface exactly which field is missing or invalid.
  validateVehicleInput(vehicleData);
  validateDeviceInput(deviceData);

  // Normalise whitespace now that we know the values are non-blank strings.
  const normalizedPlate = (vehicleData.plateNumber as string).trim();
  const normalizedIdentifier = (deviceData.identifier as string).trim();

  const runInTx = async (txEm: EntityManager) => {
    // Uniqueness pre-checks
    if (await vehicleRepository.existsByPlateNumber(txEm, normalizedPlate)) {
      throw new ConflictError(
        `A vehicle with plate number '${normalizedPlate}' already exists`,
        "PLATE_NUMBER_EXISTS",
      );
    }

    if (await deviceRepository.existsByIdentifier(txEm, normalizedIdentifier)) {
      throw new ConflictError(
        `A device with identifier '${normalizedIdentifier}' already exists`,
        "DEVICE_IDENTIFIER_EXISTS",
      );
    }

    // 3a. Persist Vehicle first so its generated UUID is available.
    const vehicle = await vehicleRepository.createVehicle(txEm, {
      ...vehicleData,
      plateNumber: normalizedPlate,
      // Optional field: falls back to the DB default ("active") when omitted.
      status: vehicleData.status ?? "active",
    });

    // 3b. Persist Device, linking it to the Vehicle via its new UUID.
    // Optional fields: status defaults to "active"; vehicleId and lastSeenAt
    // are handled by the DB (null by default) when not supplied.
    const device = await deviceRepository.createDevice(txEm, {
      ...deviceData,
      identifier: normalizedIdentifier,
      vehicleId: vehicle.id,
      // Optional field: falls back to DB default ("active") when omitted.
      status: deviceData.status ?? "active",
    });

    return { vehicle, device };
  };

  if (typeof em.transactional === "function") {
    return em.transactional(runInTx);
  }
  return runInTx(em);
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
