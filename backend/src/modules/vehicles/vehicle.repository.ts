// Vehicle persistence operations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { Vehicle } from "./vehicle.entity.js";
import type {
  CreateVehicleInput,
  VehicleInput,
  VehicleUpdate,
} from "./vehicle.types.js";

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

/** Find a vehicle by its unique plate number. */
export function findByPlateNumber(
  em: EntityManager,
  plateNumber: string,
): Promise<Vehicle | null> {
  return em.findOne(Vehicle, { plateNumber });
}

/** Check whether a vehicle with the given plate number already exists. */
export async function existsByPlateNumber(
  em: EntityManager,
  plateNumber: string,
): Promise<boolean> {
  const count = await em.count(Vehicle, { plateNumber });
  return count > 0;
}

export async function createVehicle(
  em: EntityManager,
  input: VehicleInput | CreateVehicleInput,
): Promise<Vehicle> {
  const now = new Date();
  const vehicle = em.create(Vehicle, {
    ...input,
    make: input.make ?? "Unknown",
    model: input.model ?? "Unknown",
    year: input.year ?? new Date().getFullYear(),
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

export class VehicleRepository {
  constructor(private readonly em: EntityManager) {}

  listVehicles(limit: number, offset: number): Promise<[Vehicle[], number]> {
    return listVehicles(this.em, limit, offset);
  }

  findVehicle(id: string): Promise<Vehicle | null> {
    return findVehicle(this.em, id);
  }

  findByPlateNumber(plateNumber: string): Promise<Vehicle | null> {
    return findByPlateNumber(this.em, plateNumber);
  }

  existsByPlateNumber(plateNumber: string): Promise<boolean> {
    return existsByPlateNumber(this.em, plateNumber);
  }

  createVehicle(input: VehicleInput | CreateVehicleInput): Promise<Vehicle> {
    return createVehicle(this.em, input);
  }

  updateVehicle(vehicle: Vehicle, input: VehicleUpdate): Promise<Vehicle> {
    return updateVehicle(this.em, vehicle, input);
  }

  deleteVehicle(vehicle: Vehicle): Promise<void> {
    return deleteVehicle(this.em, vehicle);
  }
}
