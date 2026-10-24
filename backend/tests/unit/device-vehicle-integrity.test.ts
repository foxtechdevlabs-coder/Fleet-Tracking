// Regression tests ensuring master vehicle/device updates never mutate or delete location_history.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { createAccessToken } from "../../src/modules/auth/auth.service.js";
import { RevokedToken } from "../../src/modules/auth/revoked-token.entity.js";
import { Device } from "../../src/modules/devices/device.entity.js";
import { LatestLocation } from "../../src/modules/tracking/latest-location.entity.js";
import { LocationHistory } from "../../src/modules/tracking/location.entity.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

type EntityClass =
  | typeof Admin
  | typeof RevokedToken
  | typeof Vehicle
  | typeof Device
  | typeof LocationHistory
  | typeof LatestLocation;

function createIntegrityTestDb() {
  const admin = Object.assign(new Admin(), {
    id: randomUUID(),
    email: "integrity-admin@example.com",
    name: "Integrity Admin",
    role: "admin" as const,
    isActive: true,
  });

  const vehicleA = Object.assign(new Vehicle(), {
    id: randomUUID(),
    plateNumber: "INT-001",
    make: "Toyota",
    model: "Hilux",
    year: 2023,
    status: "active" as const,
  });

  const vehicleB = Object.assign(new Vehicle(), {
    id: randomUUID(),
    plateNumber: "INT-002",
    make: "Ford",
    model: "Ranger",
    year: 2024,
    status: "active" as const,
  });

  const device = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "GPS-INT-001",
    vehicleId: vehicleA.id,
    status: "active" as const,
  });

  const history1 = Object.assign(new LocationHistory(), {
    id: randomUUID(),
    vehicleId: vehicleA.id,
    deviceId: device.id,
    latitude: 12.9716,
    longitude: 77.5946,
    speed: 40.0,
    heading: 90,
    altitude: 900,
    recordedAt: new Date("2026-10-10T10:00:00.000Z"),
    ingestedAt: new Date("2026-10-10T10:00:05.000Z"),
  });

  const history2 = Object.assign(new LocationHistory(), {
    id: randomUUID(),
    vehicleId: vehicleA.id,
    deviceId: device.id,
    latitude: 12.972,
    longitude: 77.595,
    speed: 45.0,
    heading: 95,
    altitude: 905,
    recordedAt: new Date("2026-10-10T10:01:00.000Z"),
    ingestedAt: new Date("2026-10-10T10:01:05.000Z"),
  });

  const latestLocation = Object.assign(new LatestLocation(), {
    id: randomUUID(),
    vehicleId: vehicleA.id,
    latitude: 12.972,
    longitude: 77.595,
    speed: 45.0,
    heading: 95,
    recordedAt: new Date("2026-10-10T10:01:00.000Z"),
    updatedAt: new Date("2026-10-10T10:01:05.000Z"),
  });

  const tables = new Map<EntityClass, object[]>([
    [Admin, [admin]],
    [RevokedToken, []],
    [Vehicle, [vehicleA, vehicleB]],
    [Device, [device]],
    [LocationHistory, [history1, history2]],
    [LatestLocation, [latestLocation]],
  ]);

  const queriedEntities: EntityClass[] = [];

  const em = {
    async findOne(entity: EntityClass, where: Record<string, unknown>) {
      queriedEntities.push(entity);
      const rows = (tables.get(entity) ?? []) as Record<string, unknown>[];
      return (
        rows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) ?? null
      );
    },
    async find(entity: EntityClass, where: Record<string, unknown>) {
      queriedEntities.push(entity);
      const rows = (tables.get(entity) ?? []) as Record<string, unknown>[];
      return rows.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      );
    },
    async findAndCount(
      entity: EntityClass,
      where: Record<string, unknown>,
      options: { limit: number; offset: number },
    ) {
      queriedEntities.push(entity);
      const rows = (tables.get(entity) ?? []) as Record<string, unknown>[];
      const matches = rows.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      );
      return [
        matches.slice(options.offset, options.offset + options.limit),
        matches.length,
      ];
    },
    assign(entity: object, input: object) {
      Object.assign(entity, input, { updatedAt: new Date() });
    },
    async flush() {},
  };

  const app = createApp({ em: { fork: () => em } } as never);
  const token = createAccessToken(admin).token;

  return {
    app,
    auth: `Bearer ${token}`,
    vehicleA,
    vehicleB,
    device,
    history1,
    history2,
    latestLocation,
    tables,
    queriedEntities,
  };
}

describe("Master-Data Independence & Location History Integrity", () => {
  it("guarantees updating vehicle master data never alters or deletes location history", async () => {
    const db = createIntegrityTestDb();
    const historySnapshotBefore = JSON.stringify(
      db.tables.get(LocationHistory),
    );
    const latestSnapshotBefore = JSON.stringify(db.tables.get(LatestLocation));

    // Update Vehicle properties
    const res = await request(db.app)
      .put(`/api/v1/vehicles/${db.vehicleA.id}`)
      .set("Authorization", db.auth)
      .send({
        plateNumber: "INT-001-EDIT",
        make: "Toyota Modified",
        model: "Hilux GR",
        year: 2025,
        status: "maintenance",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.plateNumber).toBe("INT-001-EDIT");
    expect(res.body.data.make).toBe("Toyota Modified");

    // Location history must remain 100% identical and untouched
    const historySnapshotAfter = JSON.stringify(db.tables.get(LocationHistory));
    expect(historySnapshotAfter).toBe(historySnapshotBefore);

    // Latest location must remain untouched by master vehicle update
    const latestSnapshotAfter = JSON.stringify(db.tables.get(LatestLocation));
    expect(latestSnapshotAfter).toBe(latestSnapshotBefore);

    // Verify LocationHistory was never queried or touched during vehicle update
    expect(db.queriedEntities).not.toContain(LocationHistory);
  });

  it("guarantees updating device master data preserves historical location associations", async () => {
    const db = createIntegrityTestDb();
    const historySnapshotBefore = JSON.stringify(
      db.tables.get(LocationHistory),
    );

    // Update Device identifier and status
    const res = await request(db.app)
      .put(`/api/v1/devices/${db.device.id}`)
      .set("Authorization", db.auth)
      .send({
        identifier: "GPS-INT-RENAMED",
        status: "inactive",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.identifier).toBe("GPS-INT-RENAMED");

    // Location history records still exist with original vehicle and device IDs
    const historySnapshotAfter = JSON.stringify(db.tables.get(LocationHistory));
    expect(historySnapshotAfter).toBe(historySnapshotBefore);
  });

  it("supports unassigning device without affecting existing tracking history", async () => {
    const db = createIntegrityTestDb();

    // Device unassignment: vehicleId set to null
    const res = await request(db.app)
      .patch(`/api/v1/devices/${db.device.id}`)
      .set("Authorization", db.auth)
      .send({
        vehicleId: null,
        status: "unassigned",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.vehicleId).toBeNull();
    expect(res.body.data.status).toBe("unassigned");

    // Historical records still reference the original vehicleId
    const historyRows = db.tables.get(LocationHistory) as LocationHistory[];
    expect(historyRows).toHaveLength(2);
    expect(historyRows[0].vehicleId).toBe(db.vehicleA.id);
    expect(historyRows[1].vehicleId).toBe(db.vehicleA.id);
  });

  it("supports reassigning device to a new vehicle while keeping old vehicle history intact", async () => {
    const db = createIntegrityTestDb();

    // Reassign device to Vehicle B
    const res = await request(db.app)
      .patch(`/api/v1/devices/${db.device.id}`)
      .set("Authorization", db.auth)
      .send({
        vehicleId: db.vehicleB.id,
        status: "active",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.vehicleId).toBe(db.vehicleB.id);

    // Past history recorded under Vehicle A still points to Vehicle A
    const historyRows = db.tables.get(LocationHistory) as LocationHistory[];
    expect(historyRows[0].vehicleId).toBe(db.vehicleA.id);
    expect(historyRows[1].vehicleId).toBe(db.vehicleA.id);
  });
});
