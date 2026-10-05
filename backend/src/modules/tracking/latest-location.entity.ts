// Latest location entity — stores the most recent GPS position for each vehicle (one row per vehicle).
import { EntitySchema } from "@mikro-orm/core";

export class LatestLocation {
  id!: string;
  vehicleId!: string;
  latitude!: number;
  longitude!: number;
  speed!: number | null;
  heading!: number | null;
  updatedAt!: Date;
}

export const LatestLocationSchema = new EntitySchema<LatestLocation>({
  class: LatestLocation,
  tableName: "latest_locations",
  indexes: [
    { properties: ["vehicleId"], name: "idx_latest_locations_vehicle_id" },
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
      unique: true,
      comment: "FK → vehicles.id; unique — enforces one row per vehicle",
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
    updatedAt: {
      type: "Date",
      columnType: "timestamptz",
      fieldName: "updated_at",
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      comment: "Refreshed on every GPS ping for this vehicle",
    },
  },
});
