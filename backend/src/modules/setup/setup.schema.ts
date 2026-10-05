// Validate a complete vehicle and assigned device setup request.
import { AppError } from "../../common/errors/app-error.js";
import { parseDeviceCreate } from "../devices/device.schema.js";
import type { DeviceInput } from "../devices/device.types.js";
import { parseVehicleCreate } from "../vehicles/vehicle.schema.js";
import type { VehicleInput } from "../vehicles/vehicle.types.js";

export interface VehicleDeviceSetupInput {
  vehicle: VehicleInput;
  device: Omit<DeviceInput, "vehicleId">;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${label} must be a JSON object`,
    );
  }
  return value as Record<string, unknown>;
}

function allowKeys(
  input: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  const unexpected = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${label} contains unsupported field(s): ${unexpected.join(", ")}`,
    );
  }
}

export function parseVehicleDeviceSetup(
  body: unknown,
): VehicleDeviceSetupInput {
  const input = record(body, "request");
  allowKeys(input, ["vehicle", "device"], "request");
  const vehicle = record(input.vehicle, "vehicle");
  const device = record(input.device, "device");
  allowKeys(
    vehicle,
    ["plateNumber", "make", "model", "year", "status"],
    "vehicle",
  );
  allowKeys(device, ["identifier", "status"], "device");

  const parsedDevice = parseDeviceCreate(device);
  if (parsedDevice.status === "unassigned") {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "A device created in this setup flow must have status active or inactive",
    );
  }

  return {
    vehicle: parseVehicleCreate(vehicle),
    device: {
      identifier: parsedDevice.identifier,
      status: parsedDevice.status ?? "active",
    },
  };
}
