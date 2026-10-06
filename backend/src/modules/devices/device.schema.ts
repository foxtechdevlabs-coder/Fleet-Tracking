// Validate device API inputs and path parameters.
import { AppError } from "../../common/errors/app-error.js";
import type {
  DeviceInput,
  DeviceStatus,
  DeviceUpdate,
} from "./device.types.js";

const statuses: DeviceStatus[] = ["active", "inactive", "unassigned"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, "VALIDATION_ERROR", "A JSON object is required");
  }
  return body as Record<string, unknown>;
}

function readFields(body: unknown, partial: boolean): DeviceUpdate {
  const input = objectBody(body);
  const allowedFields = ["identifier", "vehicleId", "status"];
  const unsupportedFields = Object.keys(input).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unsupportedFields.length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Unsupported device field(s): ${unsupportedFields.join(", ")}`,
    );
  }

  const output: DeviceUpdate = {};
  const has = (key: string) => Object.hasOwn(input, key);

  if (!partial || has("identifier")) {
    if (
      typeof input.identifier !== "string" ||
      input.identifier.trim().length < 1 ||
      input.identifier.trim().length > 100
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "identifier must be 1-100 characters",
      );
    }
    output.identifier = input.identifier.trim();
  }

  if (has("vehicleId")) {
    if (
      input.vehicleId !== null &&
      (typeof input.vehicleId !== "string" ||
        !uuidPattern.test(input.vehicleId))
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "vehicleId must be a UUID or null",
      );
    }
    output.vehicleId = input.vehicleId;
  }

  if (has("status")) {
    if (!statuses.includes(input.status as DeviceStatus)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "status is not a supported device status",
      );
    }
    output.status = input.status as DeviceStatus;
  }

  if (partial && Object.keys(output).length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "At least one device field is required",
    );
  }

  return output;
}

export function parseDeviceCreate(body: unknown): DeviceInput {
  return readFields(body, false) as DeviceInput;
}

export function parseDeviceUpdate(body: unknown): DeviceUpdate {
  return readFields(body, true);
}

export function parseDeviceUuid(
  value: string | string[] | undefined,
  label: string,
): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${label} must be a valid UUID`,
    );
  }
  return value;
}
