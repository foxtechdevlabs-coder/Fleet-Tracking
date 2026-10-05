// Device entity — GPS tracking device, optionally assigned to a vehicle.
import { EntitySchema } from "@mikro-orm/core";
import type { DeviceStatus } from "./device.types.js";

export class Device {
  id!: string;
  identifier!: string;
  vehicleId!: string | null;
  status!: DeviceStatus;
  lastSeenAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export const DeviceSchema = new EntitySchema<Device>({
  class: Device,
  tableName: "devices",
  indexes: [{ properties: ["vehicleId"], name: "idx_devices_vehicle_id" }],
  properties: {
    id: {
      type: "uuid",
      primary: true,
      defaultRaw: "gen_random_uuid()",
    },
    identifier: {
      type: "string",
      length: 100,
      unique: true,
      comment: "IMEI, serial number, or other unique device identifier",
    },
    vehicleId: {
      type: "uuid",
      fieldName: "vehicle_id",
      nullable: true,
      default: null,
      comment: "FK → vehicles.id; null when device is unassigned",
    },
    status: {
      type: "string",
      length: 20,
      default: "unassigned",
      comment: "Allowed values: active, inactive, unassigned",
    },
    lastSeenAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "last_seen_at",
      nullable: true,
      comment: "Timestamp of the last received GPS ping",
    },
    createdAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "created_at",
      onCreate: () => new Date(),
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
