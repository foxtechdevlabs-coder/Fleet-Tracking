// Unit and API integration tests for Settings module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { createAccessToken } from "../../src/modules/auth/auth.service.js";
import { RevokedToken } from "../../src/modules/auth/revoked-token.entity.js";
import { SystemSetting } from "../../src/modules/settings/settings.entity.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

type EntityClass =
  | typeof Admin
  | typeof RevokedToken
  | typeof Vehicle
  | typeof SystemSetting;

function createTestDatabase() {
  const admin = Object.assign(new Admin(), {
    id: randomUUID(),
    email: "settings-admin@example.com",
    name: "Settings Admin",
    role: "admin" as const,
    isActive: true,
  });

  const vehicle = Object.assign(new Vehicle(), {
    id: randomUUID(),
    plateNumber: "SET-001",
    make: "Toyota",
    model: "Hilux",
    year: 2024,
    status: "active" as const,
  });

  const otherVehicle = Object.assign(new Vehicle(), {
    id: randomUUID(),
    plateNumber: "SET-002",
    make: "Ford",
    model: "Ranger",
    year: 2023,
    status: "active" as const,
  });

  const tables = new Map<EntityClass, object[]>([
    [Admin, [admin]],
    [RevokedToken, []],
    [Vehicle, [vehicle, otherVehicle]],
    [SystemSetting, []],
  ]);

  const pending: object[] = [];

  const em = {
    async findOne(entity: EntityClass, where: Record<string, unknown>) {
      const rows = (tables.get(entity) ?? []) as Record<string, unknown>[];
      return (
        rows.find((row) =>
          Object.entries(where).every(([key, value]) => row[key] === value),
        ) ?? null
      );
    },
    async find(entity: EntityClass, where: Record<string, unknown>) {
      const rows = (tables.get(entity) ?? []) as Record<string, unknown>[];
      return rows.filter((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value),
      );
    },
    create(entity: EntityClass, input: object) {
      return Object.assign(Object.create(entity.prototype), input, {
        id: (input as { id?: string }).id ?? randomUUID(),
      });
    },
    persist(entity: object) {
      pending.push(entity);
    },
    assign(entity: object, input: object) {
      Object.assign(entity, input, { updatedAt: new Date() });
    },
    async flush() {
      for (const row of pending) {
        if (row instanceof SystemSetting) {
          tables.get(SystemSetting)?.push(row);
        }
      }
      pending.length = 0;
    },
  };

  const app = createApp({ em: { fork: () => em } } as never);
  const token = createAccessToken(admin).token;

  return {
    app,
    auth: `Bearer ${token}`,
    vehicle,
    otherVehicle,
    tables,
  };
}

describe("Settings API & Business Logic", () => {
  it("requires admin authentication", async () => {
    const db = createTestDatabase();
    const res = await request(db.app).get("/api/v1/settings");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("retrieves default settings when no settings stored", async () => {
    const db = createTestDatabase();
    const res = await request(db.app)
      .get("/api/v1/settings")
      .set("Authorization", db.auth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data["general.timezone"]).toBe("UTC");
    expect(res.body.data["tracking.speed_unit"]).toBe("km/h");
    expect(res.body.data["tracking.stale_threshold_seconds"]).toBe(300);
  });

  it("validates and sets IANA timezone configuration", async () => {
    const db = createTestDatabase();

    // Invalid timezone
    const invalidRes = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "general.timezone",
        value: "Mars/Olympus_Mons",
      });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.code).toBe("VALIDATION_ERROR");

    // Valid IANA timezones
    const validRes = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "general.timezone",
        value: "Asia/Kolkata",
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.value).toBe("Asia/Kolkata");

    // Verify stored
    const checkRes = await request(db.app)
      .get("/api/v1/settings/general.timezone")
      .set("Authorization", db.auth);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.value).toBe("Asia/Kolkata");
  });

  it("restricts tracking.speed_unit strictly to 'km/h' and 'mph'", async () => {
    const db = createTestDatabase();

    // Non-approved unit: knots
    const invalidRes1 = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.speed_unit",
        value: "knots",
      });
    expect(invalidRes1.status).toBe(400);
    expect(invalidRes1.body.code).toBe("VALIDATION_ERROR");

    // Non-approved unit: m/s
    const invalidRes2 = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.speed_unit",
        value: "m/s",
      });
    expect(invalidRes2.status).toBe(400);
    expect(invalidRes2.body.code).toBe("VALIDATION_ERROR");

    // Approved unit: mph
    const validRes = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.speed_unit",
        value: "mph",
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.value).toBe("mph");
  });

  it("validates tracking.stale_threshold_seconds within bounds [30, 86400]", async () => {
    const db = createTestDatabase();

    // Under minimum (29s)
    const tooLow = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.stale_threshold_seconds",
        value: 29,
      });
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.code).toBe("VALIDATION_ERROR");

    // Over maximum (86401s)
    const tooHigh = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.stale_threshold_seconds",
        value: 86401,
      });
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body.code).toBe("VALIDATION_ERROR");

    // Valid threshold (600s = 10 minutes)
    const valid = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.stale_threshold_seconds",
        value: 600,
      });
    expect(valid.status).toBe(200);
    expect(valid.body.data.value).toBe(600);
  });

  it("supports per-vehicle override with fallback to global settings", async () => {
    const db = createTestDatabase();

    // Set global speed unit to km/h
    await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.speed_unit",
        value: "km/h",
      });

    // Override vehicle 1 to mph
    const perVehicleRes = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.speed_unit",
        value: "mph",
        scope: "per_vehicle",
        vehicleId: db.vehicle.id,
      });
    expect(perVehicleRes.status).toBe(200);
    expect(perVehicleRes.body.data.scope).toBe("per_vehicle");
    expect(perVehicleRes.body.data.vehicleId).toBe(db.vehicle.id);
    expect(perVehicleRes.body.data.value).toBe("mph");

    // Vehicle 1 should resolve to mph
    const vehicle1Settings = await request(db.app)
      .get(`/api/v1/settings?vehicleId=${db.vehicle.id}`)
      .set("Authorization", db.auth);
    expect(vehicle1Settings.status).toBe(200);
    expect(vehicle1Settings.body.data["tracking.speed_unit"]).toBe("mph");

    // Vehicle 2 (no override) should fall back to global km/h
    const vehicle2Settings = await request(db.app)
      .get(`/api/v1/settings?vehicleId=${db.otherVehicle.id}`)
      .set("Authorization", db.auth);
    expect(vehicle2Settings.status).toBe(200);
    expect(vehicle2Settings.body.data["tracking.speed_unit"]).toBe("km/h");

    // Global query should remain km/h
    const globalSettings = await request(db.app)
      .get("/api/v1/settings")
      .set("Authorization", db.auth);
    expect(globalSettings.body.data["tracking.speed_unit"]).toBe("km/h");
  });

  it("rejects per-vehicle settings assigned to non-existent vehicle", async () => {
    const db = createTestDatabase();
    const res = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        key: "tracking.speed_unit",
        value: "mph",
        scope: "per_vehicle",
        vehicleId: randomUUID(),
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VEHICLE_NOT_FOUND");
  });

  it("supports batch updates via dictionary payload", async () => {
    const db = createTestDatabase();
    const res = await request(db.app)
      .patch("/api/v1/settings")
      .set("Authorization", db.auth)
      .send({
        "general.timezone": "America/New_York",
        "tracking.stale_threshold_seconds": 450,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const map = await request(db.app)
      .get("/api/v1/settings")
      .set("Authorization", db.auth);
    expect(map.body.data["general.timezone"]).toBe("America/New_York");
    expect(map.body.data["tracking.stale_threshold_seconds"]).toBe(450);
  });
});
