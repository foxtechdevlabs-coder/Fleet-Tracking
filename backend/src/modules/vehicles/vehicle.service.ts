// Vehicle business rules and not-found handling.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import { NotFoundError } from "../../common/errors/app-errors.js";
import * as repository from "./vehicle.repository.js";
import type { VehicleInput, VehicleUpdate } from "./vehicle.types.js";

export const listVehicles = repository.listVehicles;

export async function createVehicle(em: EntityManager, input: VehicleInput) {
  if (await repository.findVehicleByPlateNumber(em, input.plateNumber)) {
    throw new AppError(
      409,
      "VEHICLE_IDENTIFIER_EXISTS",
      "Vehicle identifier already exists",
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
