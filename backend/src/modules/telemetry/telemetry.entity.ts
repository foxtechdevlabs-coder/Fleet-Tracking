// Telemetry entity — vehicle sensor events (ignition, fuel level, diagnostics, alerts, etc.).
import { EntitySchema } from "@mikro-orm/core";

export class TelemetryEvent {
  id!: string;
  vehicleId!: string;
  deviceId!: string;
  eventType!: string;
  payload!: Record<string, unknown>;
  recordedAt!: Date;
  ingestedAt!: Date;
}

export const TelemetryEventSchema = new EntitySchema<TelemetryEvent>({
  class: TelemetryEvent,
  tableName: "telemetry_events",
  indexes: [
    { properties: ["vehicleId"], name: "idx_telemetry_vehicle_id" },
    { properties: ["deviceId"], name: "idx_telemetry_device_id" },
    { properties: ["eventType"], name: "idx_telemetry_event_type" },
    { properties: ["recordedAt"], name: "idx_telemetry_recorded_at" },
  ],
  properties: {
    id: {
      type: "uuid",
      primary: true,
      defaultRaw: "gen_random_uuid()",
    },
    vehicleId: {
      type: "uuid",
      fieldName: "vehicle_id",
      comment: "FK → vehicles.id",
    },
    deviceId: {
      type: "uuid",
      fieldName: "device_id",
      comment: "FK → devices.id",
    },
    eventType: {
      type: "string",
      length: 100,
      fieldName: "event_type",
      comment:
        "e.g. ignition_on, ignition_off, fuel_low, harsh_brake, geofence_exit",
    },
    payload: {
      type: "json",
      columnType: "jsonb",
      defaultRaw: "'{}'::jsonb",
      comment: "Flexible sensor data; schema depends on eventType",
    },
    recordedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "recorded_at",
      comment: "Timestamp reported by the GPS device",
    },
    ingestedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "ingested_at",
      onCreate: () => new Date(),
      comment: "Timestamp when the server received the event",
    },
  },
});

export { TelemetryEvent as Telemetry, TelemetryEventSchema as TelemetrySchema };
