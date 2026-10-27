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
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request body must be a JSON object",
    );
  }
  return body as Record<string, unknown>;
}

function requiredString(
  input: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = input[key];
  if (value === undefined || value === null) {
    throw new AppError(400, "VALIDATION_ERROR", `${key} is required`);
  }
  if (typeof value !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", `${key} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${key} must be 1-${maxLength} characters`,
    );
  }
  return trimmed;
}

function readFields(body: unknown, partial: boolean): VehicleUpdate {
  const input = objectBody(body);
  const allowedFields = ["plateNumber", "make", "model", "year", "status"];
  const unsupportedFields = Object.keys(input).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unsupportedFields.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Unsupported vehicle field(s): ${unsupportedFields.join(", ")}`,
    );
  }

  const output: VehicleUpdate = {};
  const has = (key: string) => Object.hasOwn(input, key);

  if (!partial || has("plateNumber")) {
    output.plateNumber = requiredString(input, "plateNumber", 20).toUpperCase();
  }

  for (const key of ["make", "model"] as const) {
    if (!partial || has(key)) {
      output[key] = requiredString(input, key, 100);
    }
  }

  if (!partial || has("year")) {
    if (input.year === undefined || input.year === null) {
      throw new AppError(400, "VALIDATION_ERROR", "year is required");
    }
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
        `status must be one of: ${statuses.join(", ")}`,
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
