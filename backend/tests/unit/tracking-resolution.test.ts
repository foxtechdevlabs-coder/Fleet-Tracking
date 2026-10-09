// Unit tests for resolving tracked devices through their stored vehicle link.
import { describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";
import { AppError } from "../../src/common/errors/app-error.js";
import { errorHandler } from "../../src/common/errors/error-handler.js";
import { Device } from "../../src/modules/devices/device.entity.js";
import { resolveTrackingDevice } from "../../src/modules/tracking/tracking.service.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

function createResolutionDatabase(options?: {
  vehicleId?: string | null;
  omitVehicle?: boolean;
  failDeviceLookup?: boolean;
}) {
  const vehicleId =
    options?.vehicleId === undefined
      ? "5597e88d-2900-4b24-8c64-38349a031077"
      : options.vehicleId;
  const device = Object.assign(new Device(), {
    id: "184311da-7eb2-4b03-92cd-5f1dfac953db",
    identifier: "GPS-001",
    vehicleId,
    status: "active" as const,
    lastSeenAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const vehicle = Object.assign(new Vehicle(), {
    id: "5597e88d-2900-4b24-8c64-38349a031077",
    plateNumber: "AB-123",
    make: "Ford",
    model: "Transit",
    year: 2025,
    status: "active" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const otherVehicle = Object.assign(new Vehicle(), {
    ...vehicle,
    id: "b999d3e6-1bd2-4cc7-b784-0e78f56ab920",
    plateNumber: "XY-789",
  });
  const queries: Array<{
    entity: typeof Device | typeof Vehicle;
    where: object;
  }> = [];
  const em = {
    async findOne(entity: typeof Device | typeof Vehicle, where: object) {
      queries.push({ entity, where });
      if (entity === Device && options?.failDeviceLookup) {
        throw new Error("database connection details");
      }
      if (entity === Device) {
        return Object.entries(where).every(
          ([key, value]) => device[key as keyof Device] === value,
        )
          ? device
          : null;
      }
      if (options?.omitVehicle) return null;
      return vehicle.id === (where as { id?: string }).id ? vehicle : null;
    },
  };

  return { em, device, vehicle, otherVehicle, queries };
}

describe("tracking Device resolution", () => {
  it("resolves a registered Device and its Vehicle by stored association", async () => {
    const db = createResolutionDatabase();

    const resolved = await resolveTrackingDevice(db.em as never, " GPS-001 ");

    expect(resolved.device).toBe(db.device);
    expect(resolved.vehicle).toBe(db.vehicle);
    expect(db.queries).toEqual([
      { entity: Device, where: { identifier: "GPS-001" } },
      { entity: Vehicle, where: { id: db.device.vehicleId } },
    ]);
  });

  it("rejects an unknown registered identifier without creating a Device", async () => {
    const db = createResolutionDatabase();

    await expect(
      resolveTrackingDevice(db.em as never, "GPS-UNKNOWN"),
    ).rejects.toMatchObject({
      status: 404,
      code: "DEVICE_NOT_FOUND",
      message: "Registered device was not found",
    });
    expect(db.queries).toEqual([
      { entity: Device, where: { identifier: "GPS-UNKNOWN" } },
    ]);
  });

  it("rejects unassigned Devices because location history requires a Vehicle", async () => {
    const db = createResolutionDatabase({ vehicleId: null });

    await expect(
      resolveTrackingDevice(db.em as never, "GPS-001"),
    ).rejects.toMatchObject({
      status: 409,
      code: "DEVICE_NOT_ASSIGNED",
      message: "Device is not assigned to a vehicle",
    });
    expect(db.queries).toHaveLength(1);
  });

  it("rejects dangling or inconsistent stored Vehicle references", async () => {
    const db = createResolutionDatabase({
      vehicleId: "b999d3e6-1bd2-4cc7-b784-0e78f56ab920",
      omitVehicle: true,
    });

    await expect(
      resolveTrackingDevice(db.em as never, "GPS-001"),
    ).rejects.toMatchObject({
      status: 409,
      code: "DEVICE_VEHICLE_ASSOCIATION_INVALID",
    });
  });

  it("does not permit tracking input to supply a replacement Vehicle ID", async () => {
    const db = createResolutionDatabase();

    await expect(
      resolveTrackingDevice(db.em as never, {
        identifier: "GPS-001",
        vehicleId: db.otherVehicle.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
    const resolved = await resolveTrackingDevice(db.em as never, "GPS-001");
    expect(resolved.vehicle.id).toBe(db.device.vehicleId);
    expect(resolved.vehicle.id).not.toBe(db.otherVehicle.id);
  });

  it("rejects missing, empty, non-string, and oversized identifiers", async () => {
    const db = createResolutionDatabase();

    for (const value of [undefined, null, "", "   ", 123, "x".repeat(101)]) {
      await expect(
        resolveTrackingDevice(db.em as never, value),
      ).rejects.toMatchObject({
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }
    expect(db.queries).toHaveLength(0);
  });

  it("propagates database failures for the global handler to safely convert", async () => {
    const db = createResolutionDatabase({ failDeviceLookup: true });
    const app = express();
    app.get("/resolve", async (_req, res) => {
      const resolved = await resolveTrackingDevice(db.em as never, "GPS-001");
      res.json(resolved);
    });
    app.use(errorHandler);
    const response = await request(app).get("/resolve");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "database connection details",
    );
  });
});
