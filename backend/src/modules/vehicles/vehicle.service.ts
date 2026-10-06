// Vehicle business rules and not-found handling.
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  ConflictError,
  NotFoundError,
} from "../../common/errors/app-errors.js";
import * as repository from "./vehicle.repository.js";
import type {
  CreateVehicleInput,
  VehicleInput,
  VehicleUpdate,
} from "./vehicle.types.js";

export const listVehicles = repository.listVehicles;

/**
 * Create a vehicle after checking for plate number uniqueness.
 *
 * Accepts both legacy VehicleInput and the newer CreateVehicleInput.
 * The application-level check provides a friendly error message; the DB
 * UNIQUE constraint is the ultimate safeguard against races.
 */
export async function createVehicle(
  em: EntityManager,
  input: VehicleInput | CreateVehicleInput,
) {
  if (await repository.existsByPlateNumber(em, input.plateNumber)) {
    throw new ConflictError(
      "Vehicle with this plate number already exists",
      "PLATE_NUMBER_EXISTS",
    );
  }
  return repository.createVehicle(em, input);
}

export async function getVehicle(em: EntityManager, id: string) {
  const vehicle = await repository.findVehicle(em, id);
  if (!vehicle) {
    throw new NotFoundError("Vehicle was not found", "VEHICLE_NOT_FOUND");
  }
  return vehicle;
}

export async function updateVehicle(
  em: EntityManager,
  id: string,
  input: VehicleUpdate,
) {
  return repository.updateVehicle(em, await getVehicle(em, id), input);
}

export async function deleteVehicle(em: EntityManager, id: string) {
  await repository.deleteVehicle(em, await getVehicle(em, id));
}

export type { VehicleInput, VehicleUpdate };
