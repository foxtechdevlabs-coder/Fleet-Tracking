// Settings repository — persistence layer for system and per-vehicle configurations.
import type { EntityManager } from "@mikro-orm/postgresql";
import { SystemSetting } from "./settings.entity.js";
import type { SettingInput, SettingsFilter } from "./settings.types.js";

/**
 * Find setting by exact key and vehicleId (null for global).
 */
export async function findSettingByKeyAndVehicle(
  em: EntityManager,
  key: string,
  vehicleId: string | null = null,
): Promise<SystemSetting | null> {
  return em.findOne(SystemSetting, { key, vehicleId });
}

/**
 * Find effective setting for a key, where vehicle-level setting overrides global.
 */
export async function findEffectiveSetting(
  em: EntityManager,
  key: string,
  vehicleId?: string | null,
): Promise<SystemSetting | null> {
  if (vehicleId) {
    const vehicleSetting = await em.findOne(SystemSetting, {
      key,
      vehicleId,
    });
    if (vehicleSetting) {
      return vehicleSetting;
    }
  }

  // Fall back to global setting
  return em.findOne(SystemSetting, {
    key,
    vehicleId: null,
  });
}

/**
 * List all settings matching optional filter (vehicleId or scope).
 */
export async function listSettings(
  em: EntityManager,
  filter?: SettingsFilter,
): Promise<SystemSetting[]> {
  const where: Record<string, unknown> = {};

  if (filter?.key) {
    where.key = filter.key;
  }
  if (filter?.scope) {
    where.scope = filter.scope;
  }
  if (filter?.vehicleId !== undefined) {
    where.vehicleId = filter.vehicleId;
  }

  return em.find(SystemSetting, where, {
    orderBy: { key: "ASC", scope: "ASC" },
  });
}

/**
 * Upsert a setting into the database.
 */
export async function upsertSetting(
  em: EntityManager,
  input: SettingInput,
): Promise<SystemSetting> {
  const vehicleId = input.vehicleId ?? null;
  const scope = input.scope ?? (vehicleId ? "per_vehicle" : "global");

  let setting = await em.findOne(SystemSetting, {
    key: input.key,
    vehicleId,
  });

  const now = new Date();

  if (setting) {
    em.assign(setting, {
      value: input.value,
      scope,
      updatedAt: now,
    });
  } else {
    setting = em.create(SystemSetting, {
      key: input.key,
      value: input.value,
      scope,
      vehicleId,
      updatedAt: now,
    });
    em.persist(setting);
  }

  await em.flush();
  return setting;
}
