// Create a vehicle and its assigned device atomically.
import type { EntityManager } from "@mikro-orm/postgresql";
import { createDevice } from "../devices/device.service.js";
import { createVehicle } from "../vehicles/vehicle.service.js";
import type { VehicleDeviceSetupInput } from "./setup.schema.js";

export function createVehicleDeviceSetup(
  em: EntityManager,
  input: VehicleDeviceSetupInput,
) {
  return em.transactional(async (transactionalEm) => {
    const vehicle = await createVehicle(transactionalEm, input.vehicle);
    const device = await createDevice(transactionalEm, {
      ...input.device,
      vehicleId: vehicle.id,
    });

    return { vehicle, device };
  });
}
