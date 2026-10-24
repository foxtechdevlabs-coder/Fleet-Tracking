// Settings service — business logic for configuration management and fallback.
import type { EntityManager } from "@mikro-orm/postgresql";
import { AppError } from "../../common/errors/app-error.js";
import { Vehicle } from "../vehicles/vehicle.entity.js";
import * as repository from "./settings.repository.js";
import { DEFAULT_SETTINGS, validateSettingValue } from "./settings.schema.js";
import type {
  SettingDto,
  SettingInput,
  SettingsFilter,
} from "./settings.types.js";

/**
 * Validate that a vehicle exists before saving a vehicle-scoped setting.
 */
async function validateVehicleExists(
  em: EntityManager,
  vehicleId: string | null,
): Promise<void> {
  if (vehicleId) {
    const vehicle = await em.findOne(Vehicle, { id: vehicleId });
    if (!vehicle) {
      throw new AppError(404, "VEHICLE_NOT_FOUND", "Vehicle was not found");
    }
  }
}

/**
 * Get effective value for a given setting key, with per-vehicle -> global -> default fallback.
 */
export async function getEffectiveSettingValue<T = unknown>(
  em: EntityManager,
  key: string,
  vehicleId?: string | null,
): Promise<T> {
  const setting = await repository.findEffectiveSetting(em, key, vehicleId);
  if (setting) {
    return setting.value as T;
  }
  return DEFAULT_SETTINGS[key] as T;
}

/**
 * Get single setting record (or fallback DTO if not stored in DB).
 */
export async function getSettingRecord(
  em: EntityManager,
  key: string,
  vehicleId?: string | null,
): Promise<SettingDto> {
  const setting = await repository.findEffectiveSetting(em, key, vehicleId);
  if (setting) {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      scope: setting.scope,
      vehicleId: setting.vehicleId,
      updatedAt: setting.updatedAt,
    };
  }

  const defaultValue = DEFAULT_SETTINGS[key];
  if (defaultValue === undefined) {
    throw new AppError(
      404,
      "SETTING_NOT_FOUND",
      `Setting '${key}' was not found`,
    );
  }

  return {
    id: "default",
    key,
    value: defaultValue,
    scope: vehicleId ? "per_vehicle" : "global",
    vehicleId: vehicleId ?? null,
    updatedAt: new Date(),
  };
}

/**
 * Get map of all effective settings, merging defaults with global settings and per-vehicle overrides.
 */
export async function getEffectiveSettingsMap(
  em: EntityManager,
  vehicleId?: string | null,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  // Load global settings
  const globalSettings = await repository.listSettings(em, { scope: "global" });
  for (const s of globalSettings) {
    result[s.key] = s.value;
  }

  // If vehicleId specified, load and overlay per-vehicle settings
  if (vehicleId) {
    const vehicleSettings = await repository.listSettings(em, { vehicleId });
    for (const s of vehicleSettings) {
      result[s.key] = s.value;
    }
  }

  return result;
}

/**
 * List all raw stored settings or filter by scope / vehicleId.
 */
export async function listStoredSettings(
  em: EntityManager,
  filter?: SettingsFilter,
): Promise<SettingDto[]> {
  const settings = await repository.listSettings(em, filter);
  return settings.map((s) => ({
    id: s.id,
    key: s.key,
    value: s.value,
    scope: s.scope,
    vehicleId: s.vehicleId,
    updatedAt: s.updatedAt,
  }));
}

/**
 * Upsert a single setting.
 */
export async function upsertSetting(
  em: EntityManager,
  input: SettingInput,
): Promise<SettingDto> {
  validateSettingValue(input.key, input.value);
  await validateVehicleExists(em, input.vehicleId ?? null);

  const setting = await repository.upsertSetting(em, input);
  return {
    id: setting.id,
    key: setting.key,
    value: setting.value,
    scope: setting.scope,
    vehicleId: setting.vehicleId,
    updatedAt: setting.updatedAt,
  };
}

/**
 * Upsert multiple settings in a batch.
 */
export async function upsertSettingsBatch(
  em: EntityManager,
  inputs: SettingInput[],
): Promise<SettingDto[]> {
  const results: SettingDto[] = [];
  for (const input of inputs) {
    const updated = await upsertSetting(em, input);
    results.push(updated);
  }
  return results;
}
