// Validate vehicle API inputs and path parameters.
import { AppError } from "../../common/errors/app-error.js";
import type {
  VehicleInput,
  VehicleStatus,
  VehicleUpdate,
} from "./vehicle.types.js";

const statuses: VehicleStatus[] = ["active", "inactive", "maintenance"];

function objectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "A JSON object is required");
  }
  return body as Record<string, unknown>;
}

function readFields(body: unknown, partial: boolean): VehicleUpdate {
  const input = objectBody(body);
  const output: VehicleUpdate = {};
  const has = (key: string) => Object.hasOwn(input, key);

  if (!partial || has("plateNumber")) {
    if (
      typeof input.plateNumber !== "string" ||
      input.plateNumber.trim().length < 1 ||
      input.plateNumber.trim().length > 20
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "plateNumber must be 1-20 characters",
      );
    }
    output.plateNumber = input.plateNumber.trim().toUpperCase();
  }

  for (const key of ["make", "model"] as const) {
    if (!partial || has(key)) {
      const value = input[key];
      if (
        typeof value !== "string" ||
        value.trim().length < 1 ||
        value.trim().length > 100
      ) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `${key} must be 1-100 characters`,
        );
      }
      output[key] = value.trim();
    }
  }

  if (!partial || has("year")) {
    if (
      typeof input.year !== "number" ||
      !Number.isInteger(input.year) ||
      input.year < 1900 ||
      input.year > 2100
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "year must be an integer from 1900 to 2100",
      );
    }
    output.year = input.year;
  }

  if (has("status")) {
    if (!statuses.includes(input.status as VehicleStatus)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "status is not a supported vehicle status",
      );
    }
    output.status = input.status as VehicleStatus;
  }

  if (partial && Object.keys(output).length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "At least one vehicle field is required",
    );
  }

  return output;
}

export function parseVehicleCreate(body: unknown): VehicleInput {
  return readFields(body, false) as VehicleInput;
}

export function parseVehicleUpdate(body: unknown): VehicleUpdate {
  return readFields(body, true);
}

export function parseUuid(
  value: string | string[] | undefined,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${label} must be a valid UUID`,
    );
  }
  return value;
}
