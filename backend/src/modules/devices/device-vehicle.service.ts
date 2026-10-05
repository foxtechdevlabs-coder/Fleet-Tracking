// Transactional device + vehicle combined creation.
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  ConflictError,
  NotFoundError,
} from "../../common/errors/app-errors.js";
import type { Device } from "./device.entity.js";
import type { Vehicle } from "../vehicles/vehicle.entity.js";
import * as deviceRepository from "./device.repository.js";
import * as vehicleRepository from "../vehicles/vehicle.repository.js";
import type { CreateDeviceInput } from "./device.types.js";
import type { CreateVehicleInput } from "../vehicles/vehicle.types.js";

/**
 * Create a Vehicle and a Device linked to it within a single transaction.
 *
 * The entire operation is wrapped in `em.transactional()` so that if any step
 * fails both inserts are rolled back automatically.
 *
 * Uniqueness checks are performed at the application level before persisting:
 *  - Vehicle plate number must be unique.
 *  - Device identifier must be unique.
 *
 * @returns The newly created vehicle and device.
 */
export async function createDeviceWithVehicle(
  em: EntityManager,
  vehicleInput: CreateVehicleInput,
  deviceInput: Omit<CreateDeviceInput, "vehicleId">,
): Promise<{ vehicle: Vehicle; device: Device }> {
  return em.transactional(async (txEm) => {
    // --- Vehicle ---
    if (await vehicleRepository.existsByPlateNumber(txEm, vehicleInput.plateNumber)) {
      throw new ConflictError(
        "Vehicle with this plate number already exists",
        "PLATE_NUMBER_EXISTS",
      );
    }
    const vehicle = await vehicleRepository.createVehicle(txEm, vehicleInput);

    // --- Device (linked to the new vehicle) ---
    if (await deviceRepository.existsByIdentifier(txEm, deviceInput.identifier)) {
      throw new ConflictError(
        "A device with this identifier already exists",
        "DEVICE_IDENTIFIER_EXISTS",
      );
    }
    const device = await deviceRepository.createDevice(txEm, {
      ...deviceInput,
      vehicleId: vehicle.id,
    });

    return { vehicle, device };
  });
}
