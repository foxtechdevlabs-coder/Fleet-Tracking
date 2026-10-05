// Create a vehicle and its assigned device atomically.
import type { EntityManager } from "@mikro-orm/postgresql";
import * as deviceRepository from "../devices/device.repository.js";
import * as vehicleRepository from "../vehicles/vehicle.repository.js";
import type { VehicleDeviceSetupInput } from "./setup.schema.js";

export function createVehicleDeviceSetup(
  em: EntityManager,
  input: VehicleDeviceSetupInput,
) {
  return em.transactional(async (transactionalEm) => {
    const vehicle = await vehicleRepository.createVehicle(
      transactionalEm,
      input.vehicle,
    );
    const device = await deviceRepository.createDevice(transactionalEm, {
      ...input.device,
      vehicleId: vehicle.id,
    });

    return { vehicle, device };
  });
}
