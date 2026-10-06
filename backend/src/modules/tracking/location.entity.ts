// Location entity — append-only GPS location history for a vehicle.
import { EntitySchema } from "@mikro-orm/core";

export class LocationHistory {
  id!: string;
  vehicleId!: string;
  deviceId!: string;
  latitude!: number;
  longitude!: number;
  speed!: number | null;
  heading!: number | null;
  altitude!: number | null;
  recordedAt!: Date;
  ingestedAt!: Date;
}

export const LocationHistorySchema = new EntitySchema<LocationHistory>({
  class: LocationHistory,
  tableName: "location_history",
  indexes: [
    { properties: ["vehicleId"], name: "idx_location_history_vehicle_id" },
    { properties: ["deviceId"], name: "idx_location_history_device_id" },
    { properties: ["recordedAt"], name: "idx_location_history_recorded_at" },
    {
      properties: ["vehicleId", "recordedAt"],
      name: "idx_location_history_vehicle_recorded",
    },
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
    latitude: {
      type: "number",
      columnType: "double precision",
    },
    longitude: {
      type: "number",
      columnType: "double precision",
    },
    speed: {
      type: "number",
      columnType: "real",
      nullable: true,
      comment: "Speed in km/h",
    },
    heading: {
      type: "number",
      columnType: "real",
      nullable: true,
      comment: "Heading in degrees (0–360)",
    },
    altitude: {
      type: "number",
      columnType: "real",
      nullable: true,
      comment: "Altitude in metres above sea level",
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
      comment: "Timestamp when the server received the reading",
    },
  },
});

export { LocationHistory as Location, LocationHistorySchema as LocationSchema };
