// Report query and resolution services.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import * as deviceRepository from "../devices/device.repository.js";
import * as vehicleRepository from "../vehicles/vehicle.repository.js";
import * as repository from "./report.repository.js";
import type { LocationReportFilters } from "./report.schema.js";
import type { LocationReportRecord } from "./report.types.js";
import { toLocationReportRecord } from "./report.types.js";

export async function getLocationReport(
  em: EntityManager,
  filters: LocationReportFilters,
): Promise<LocationReportRecord[]> {
  let deviceId: string | undefined;
  if (filters.vehicleId) {
    const vehicle = await vehicleRepository.findVehicle(em, filters.vehicleId);
    if (!vehicle) {
      throw new AppError(404, "VEHICLE_NOT_FOUND", "Vehicle was not found");
    }
  }
  if (filters.deviceIdentifier) {
    const device = await deviceRepository.findDeviceByIdentifier(
      em,
      filters.deviceIdentifier,
    );
    if (!device) {
      throw new AppError(
        404,
        "DEVICE_NOT_FOUND",
        "Registered device was not found",
      );
    }
    deviceId = device.id;
  }

  const rows = await repository.findLocationReport(em, {
    ...filters,
    deviceId,
  });
  return rows.map(toLocationReportRecord);
}
