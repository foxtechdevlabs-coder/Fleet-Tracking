// Settings entity — key-value configuration store, scoped globally or per vehicle.
import { EntitySchema } from "@mikro-orm/core";

export class SystemSetting {
  id!: string;
  key!: string;
  value!: unknown;
  scope!: "global" | "per_vehicle";
  vehicleId!: string | null;
  updatedAt!: Date;
}

export const SystemSettingSchema = new EntitySchema<SystemSetting>({
  class: SystemSetting,
  tableName: "settings",
  uniques: [
    { properties: ["key", "vehicleId"], name: "uq_settings_key_vehicle" },
  ],
  indexes: [
    { properties: ["scope"], name: "idx_settings_scope" },
  ],
  properties: {
    id: {
      type: "uuid",
      primary: true,
      defaultRaw: "gen_random_uuid()",
    },
    key: {
      type: "string",
      length: 255,
      comment: "Dot-notation setting key, e.g. alerts.speed_limit_kmh",
    },
    value: {
      type: "json",
      columnType: "jsonb",
      comment: "Flexible value; any JSON-serialisable type",
    },
    scope: {
      type: "string",
      length: 20,
      default: "global",
      comment: "Allowed values: global, per_vehicle",
    },
    vehicleId: {
      type: "uuid",
      fieldName: "vehicle_id",
      nullable: true,
      default: null,
      comment: "FK → vehicles.id; null for global-scoped settings",
    },
    updatedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "updated_at",
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
    },
  },
});

export { SystemSetting as Setting, SystemSettingSchema as SettingSchema };

