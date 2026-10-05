// Vehicle persistence operations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { Vehicle } from "./vehicle.entity.js";
import type { VehicleInput, VehicleUpdate } from "./vehicle.types.js";

export function listVehicles(
  em: EntityManager,
  limit: number,
  offset: number,
): Promise<[Vehicle[], number]> {
  return em.findAndCount(
    Vehicle,
    {},
    { orderBy: { createdAt: "DESC" }, limit, offset },
  );
}

export function findVehicle(
  em: EntityManager,
  id: string,
): Promise<Vehicle | null> {
  return em.findOne(Vehicle, { id });
}

export async function createVehicle(
  em: EntityManager,
  input: VehicleInput,
): Promise<Vehicle> {
  const now = new Date();
  const vehicle = em.create(Vehicle, {
    ...input,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });
  em.persist(vehicle);
  await em.flush();
  return vehicle;
}

export async function updateVehicle(
  em: EntityManager,
  vehicle: Vehicle,
  input: VehicleUpdate,
): Promise<Vehicle> {
  em.assign(vehicle, input);
  await em.flush();
  return vehicle;
}

export async function deleteVehicle(
  em: EntityManager,
  vehicle: Vehicle,
): Promise<void> {
  em.remove(vehicle);
  await em.flush();
}
