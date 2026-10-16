// Report query and resolution services.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import * as deviceRepository from "../devices/device.repository.js";
import { getEffectiveSettingValue } from "../settings/settings.service.js";
import type { SpeedUnit } from "../tracking/tracking-status.util.js";
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

  let speedUnit: SpeedUnit = filters.speedUnit ?? "km/h";
  let timezone: string = filters.timezone ?? "UTC";

  // Fallback to configured settings if not passed explicitly in query
  if (!filters.speedUnit || !filters.timezone) {
    try {
      if (!filters.speedUnit) {
        const configuredUnit = await getEffectiveSettingValue<SpeedUnit>(
          em,
          "tracking.speed_unit",
          filters.vehicleId,
        );
        if (configuredUnit === "km/h" || configuredUnit === "mph") {
          speedUnit = configuredUnit;
        }
      }
      if (!filters.timezone) {
        const configuredTz = await getEffectiveSettingValue<string>(
          em,
          "general.timezone",
          filters.vehicleId,
        );
        if (typeof configuredTz === "string" && configuredTz.trim()) {
          timezone = configuredTz.trim();
        }
      }
    } catch {
      // In-memory EntityManager in tests may not have Settings table mocked
    }
  }

  const rows = await repository.findLocationReport(em, {
    ...filters,
    deviceId,
  });

  return rows.map((row) =>
    toLocationReportRecord(row, {
      speedUnit,
      timezone,
    }),
  );
}
