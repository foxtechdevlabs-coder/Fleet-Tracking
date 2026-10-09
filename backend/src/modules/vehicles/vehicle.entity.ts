// Vehicle entity — a tracked vehicle in the fleet.
import { EntitySchema } from "@mikro-orm/core";
import type { VehicleStatus } from "./vehicle.types.js";

export class Vehicle {
  id!: string;
  plateNumber!: string;
  make!: string;
  model!: string;
  year!: number;
  status!: VehicleStatus;
  createdAt!: Date;
  updatedAt!: Date;
}

export const VehicleSchema = new EntitySchema<Vehicle>({
  class: Vehicle,
  tableName: "vehicles",
  properties: {
    id: {
      type: "uuid",
      primary: true,
      defaultRaw: "gen_random_uuid()",
    },
    plateNumber: {
      type: "string",
      length: 20,
      unique: true,
      fieldName: "plate_number",
    },
    make: {
      type: "string",
      length: 100,
    },
    model: {
      type: "string",
      length: 100,
    },
    year: {
      type: "number",
      columnType: "smallint",
    },
    status: {
      type: "string",
      length: 20,
      default: "active",
      comment: "Allowed values: active, inactive, maintenance",
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
