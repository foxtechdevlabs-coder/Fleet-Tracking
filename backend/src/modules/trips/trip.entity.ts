// Trip entity — records a vehicle journey from start to finish.
import { EntitySchema } from "@mikro-orm/core";

export class Trip {
  id!: string;
  vehicleId!: string;
  startedAt!: Date;
  endedAt!: Date | null;
  startLat!: number;
  startLng!: number;
  endLat!: number | null;
  endLng!: number | null;
  distanceKm!: number;
  status!: "in_progress" | "completed";
  createdAt!: Date;
}

export const TripSchema = new EntitySchema<Trip>({
  class: Trip,
  tableName: "trips",
  indexes: [
    { properties: ["vehicleId"], name: "idx_trips_vehicle_id" },
    { properties: ["startedAt"], name: "idx_trips_started_at" },
    { properties: ["status"], name: "idx_trips_status" },
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
    startedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "started_at",
    },
    endedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "ended_at",
      nullable: true,
      comment: "Null while the trip is in progress",
    },
    startLat: {
      type: "number",
      columnType: "double precision",
      fieldName: "start_lat",
    },
    startLng: {
      type: "number",
      columnType: "double precision",
      fieldName: "start_lng",
    },
    endLat: {
      type: "number",
      columnType: "double precision",
      fieldName: "end_lat",
      nullable: true,
    },
    endLng: {
      type: "number",
      columnType: "double precision",
      fieldName: "end_lng",
      nullable: true,
    },
    distanceKm: {
      type: "number",
      columnType: "double precision",
      fieldName: "distance_km",
      default: 0,
      comment: "Total distance driven in kilometres",
    },
    status: {
      type: "string",
      length: 20,
      default: "in_progress",
      comment: "Allowed values: in_progress, completed",
    },
    createdAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "created_at",
      onCreate: () => new Date(),
    },
  },
});
