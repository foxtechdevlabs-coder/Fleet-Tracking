// HTTP and history-safety tests for authenticated vehicle and device APIs.

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { createAccessToken } from "../../src/modules/auth/auth.service.js";
import { RevokedToken } from "../../src/modules/auth/revoked-token.entity.js";
import { Device } from "../../src/modules/devices/device.entity.js";
import { TelemetryEvent } from "../../src/modules/telemetry/telemetry.entity.js";
import { LocationHistory } from "../../src/modules/tracking/location.entity.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

type EntityClass =
  | typeof Admin
  | typeof Vehicle
  | typeof Device
  | typeof RevokedToken
  | typeof LocationHistory
  | typeof TelemetryEvent;

function createDatabase() {
  const vehicle = Object.assign(new Vehicle(), {
    id: randomUUID(),
    plateNumber: "AB-123",
    make: "Ford",
    model: "Transit",
    year: 2024,
    status: "active" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const device = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "GPS-001",
    vehicleId: vehicle.id,
    status: "active" as const,
    lastSeenAt: new Date("2026-01-02T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const otherVehicle = Object.assign(new Vehicle(), {
    id: randomUUID(),
    plateNumber: "XY-789",
    make: "Other",
    model: "Van",
    year: 2023,
    status: "active" as const,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  });
  const otherDevice = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "GPS-002",
    vehicleId: null,
    status: "unassigned" as const,
    lastSeenAt: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  });
  const admin = Object.assign(new Admin(), {
    id: randomUUID(),
    email: "admin@example.com",
    name: "Test Admin",
    role: "admin" as const,
    isActive: true,
  });
  const history = Object.assign(new LocationHistory(), {
    id: randomUUID(),
    vehicleId: vehicle.id,
    deviceId: device.id,
    latitude: 51.5,
    longitude: -0.12,
    speed: 30,
    heading: 90,
    altitude: 12,
    recordedAt: new Date("2026-01-02T00:00:00.000Z"),
    ingestedAt: new Date("2026-01-02T00:01:00.000Z"),
  });
  const telemetry = Object.assign(new TelemetryEvent(), {
    id: randomUUID(),
    vehicleId: vehicle.id,
    deviceId: device.id,
    eventType: "ignition",
    payload: { state: "on" },
    recordedAt: new Date("2026-01-02T00:00:00.000Z"),
    ingestedAt: new Date("2026-01-02T00:01:00.000Z"),
  });
  const tables = new Map<EntityClass, object[]>([
    [Admin, [admin]],
    [Vehicle, [vehicle, otherVehicle]],
    [Device, [device, otherDevice]],
    [RevokedToken, []],
    [LocationHistory, [history]],
    [TelemetryEvent, [telemetry]],
  ]);
  const queriedEntities: EntityClass[] = [];
  const pending: object[] = [];
  let failDeviceList = false;
  const em = {
    async findOne(entity: EntityClass, where: Record<string, unknown>) {
      queriedEntities.push(entity);
      return (
        tables
          .get(entity)
          ?.find((row) =>
            Object.entries(where).every(
              ([key, value]) => (row as Record<string, unknown>)[key] === value,
            ),
          ) ?? null
      );
    },
    async findAndCount(
      entity: EntityClass,
      _where: Record<string, unknown>,
      options: { limit: number; offset: number },
    ) {
      queriedEntities.push(entity);
      if (entity === Device && failDeviceList) {
        throw new Error("private database detail");
      }
      const rows = tables.get(entity) ?? [];
      return [
        rows.slice(options.offset, options.offset + options.limit),
        rows.length,
      ];
    },
    create(entity: EntityClass, input: object) {
      return Object.assign(Object.create(entity.prototype), input);
    },
    persist(entity: object) {
      pending.push(entity);
    },
    assign(entity: object, input: object) {
      Object.assign(entity, input, { updatedAt: new Date() });
    },
    async flush() {
      const vehicles = [
        ...(tables.get(Vehicle) ?? []),
        ...pending.filter((row) => row instanceof Vehicle),
      ];
      const devices = [
        ...(tables.get(Device) ?? []),
        ...pending.filter((row) => row instanceof Device),
      ];
      if (
        new Set(vehicles.map((row) => (row as Vehicle).plateNumber)).size !==
          vehicles.length ||
        new Set(devices.map((row) => (row as Device).identifier)).size !==
          devices.length
      ) {
        throw Object.assign(new Error("unique constraint"), { code: "23505" });
      }
      tables
        .get(Vehicle)
        ?.push(...pending.filter((row) => row instanceof Vehicle));
      tables
        .get(Device)
        ?.push(...pending.filter((row) => row instanceof Device));
      pending.length = 0;
    },
  };
  const app = createApp({ em: { fork: () => em } } as never);
  const activeToken = createAccessToken(admin);
  const token = activeToken.token;
  const revokedToken = createAccessToken(admin);
  tables.get(RevokedToken)?.push(
    Object.assign(new RevokedToken(), {
      id: revokedToken.tokenId,
      expiresAt: revokedToken.expiresAt,
      revokedAt: new Date(),
    }),
  );
  const expiredAuth = `Bearer ${
    createAccessToken(admin, Math.floor(Date.now() / 1000) - 7200).token
  }`;
  const auth = `Bearer ${token}`;

  return {
    app,
    auth,
    expiredAuth,
    revokedAuth: `Bearer ${revokedToken.token}`,
    vehicle,
    device,
    historyRows: tables.get(LocationHistory) ?? [],
    telemetryRows: tables.get(TelemetryEvent) ?? [],
    queriedEntities,
    failDeviceList() {
      failDeviceList = true;
    },
  };
}

describe("authenticated device and vehicle APIs", () => {
  it("requires admin auth and reads collections and existing records", async () => {
    const db = createDatabase();

    const noDeviceToken = await request(db.app).get("/api/devices");
    expect(noDeviceToken.status).toBe(401);
    expect(noDeviceToken.body).toEqual({
      success: false,
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    const invalidVehicleToken = await request(db.app)
      .get("/api/vehicles")
      .set("Authorization", "Bearer invalid");
    expect(invalidVehicleToken.status).toBe(401);
    expect(invalidVehicleToken.body).toEqual({
      success: false,
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    const expiredDeviceToken = await request(db.app)
      .get("/api/devices")
      .set("Authorization", db.expiredAuth);
    expect(expiredDeviceToken.status).toBe(401);
    expect(expiredDeviceToken.body).toEqual({
      success: false,
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    const revokedVehicleToken = await request(db.app)
      .get("/api/vehicles")
      .set("Authorization", db.revokedAuth);
    expect(revokedVehicleToken.status).toBe(401);
    expect(revokedVehicleToken.body).toEqual({
      success: false,
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });

    const vehicles = await request(db.app)
      .get("/api/vehicles")
      .set("Authorization", db.auth);
    expect(vehicles.status).toBe(200);
    expect(vehicles.body.success).toBe(true);
    expect(vehicles.body.message).toBe("Vehicles retrieved successfully");
    expect(vehicles.body.data[0].id).toBe(db.vehicle.id);

    const devices = await request(db.app)
      .get("/api/devices")
      .set("Authorization", db.auth);
    expect(devices.status).toBe(200);
    expect(devices.body.success).toBe(true);
    expect(devices.body.message).toBe("Devices retrieved successfully");
    expect(devices.body.data[0].id).toBe(db.device.id);

    const vehicle = await request(db.app)
      .get(`/api/vehicles/${db.vehicle.id}`)
      .set("Authorization", db.auth);
    expect(vehicle.status).toBe(200);
    expect(vehicle.body.success).toBe(true);
    expect(vehicle.body.message).toBe("Vehicle retrieved successfully");
    expect(vehicle.body.data.plateNumber).toBe("AB-123");

    const device = await request(db.app)
      .get(`/api/devices/${db.device.id}`)
      .set("Authorization", db.auth);
    expect(device.status).toBe(200);
    expect(device.body.success).toBe(true);
    expect(device.body.message).toBe("Device retrieved successfully");
    expect(device.body.data.identifier).toBe("GPS-001");
  });

  it("validates and creates vehicle and device records", async () => {
    const db = createDatabase();
    const headers = { Authorization: db.auth };

    const missingVehicleField = await request(db.app)
      .post("/api/vehicles")
      .set(headers)
      .send({ plateNumber: "ZX-321", make: "Ford", year: 2025 });
    expect(missingVehicleField.status).toBe(400);
    expect(missingVehicleField.body.success).toBe(false);
    expect(missingVehicleField.body.code).toBe("VALIDATION_ERROR");
    expect(missingVehicleField.body.message).toBe(
      "model must be 1-100 characters",
    );

    const emptyVehicleField = await request(db.app)
      .post("/api/vehicles")
      .set(headers)
      .send({
        plateNumber: "ZX-321",
        make: " ",
        model: "Transit",
        year: 2025,
      });
    expect(emptyVehicleField.status).toBe(400);

    const invalidVehicleFormat = await request(db.app)
      .post("/api/vehicles")
      .set(headers)
      .send({
        plateNumber: "ZX-321",
        make: "Ford",
        model: "Transit",
        year: Number.NaN,
        status: "broken",
      });
    expect(invalidVehicleFormat.status).toBe(400);

    const vehicle = await request(db.app)
      .post("/api/vehicles")
      .set(headers)
      .send({
        plateNumber: "  zx-321 ",
        make: "Ford",
        model: "Transit",
        year: 2025,
      });
    expect(vehicle.status).toBe(201);
    expect(vehicle.body).toMatchObject({
      success: true,
      message: "Vehicle created successfully",
      data: { plateNumber: "ZX-321" },
    });
    expect(vehicle.body.data.plateNumber).toBe("ZX-321");

    const missingDeviceField = await request(db.app)
      .post("/api/devices")
      .set(headers)
      .send({ status: "active" });
    expect(missingDeviceField.status).toBe(400);
    expect(missingDeviceField.body).toEqual({
      success: false,
      message: "identifier must be 1-100 characters",
      code: "VALIDATION_ERROR",
    });

    const emptyDeviceField = await request(db.app)
      .post("/api/devices")
      .set(headers)
      .send({ identifier: "   " });
    expect(emptyDeviceField.status).toBe(400);

    const invalidDeviceFormat = await request(db.app)
      .post("/api/devices")
      .set(headers)
      .send({ identifier: "GPS-NEW", status: "broken" });
    expect(invalidDeviceFormat.status).toBe(400);

    const device = await request(db.app)
      .post("/api/devices")
      .set(headers)
      .send({ identifier: "  GPS-NEW  ", status: "active" });
    expect(device.status).toBe(201);
    expect(device.body).toMatchObject({
      success: true,
      message: "Device created successfully",
      data: { identifier: "GPS-NEW" },
    });
    expect(device.body.data.identifier).toBe("GPS-NEW");
  });

  it("returns 409 for duplicate and concurrent create requests", async () => {
    const db = createDatabase();
    const headers = { Authorization: db.auth };
    const vehicleBody = {
      plateNumber: "ZX-321",
      make: "Ford",
      model: "Transit",
      year: 2025,
    };
    const deviceBody = { identifier: "GPS-NEW", status: "active" };

    const firstVehicle = await request(db.app)
      .post("/api/vehicles")
      .set(headers)
      .send(vehicleBody);
    expect(firstVehicle.status).toBe(201);
    const duplicateVehicle = await request(db.app)
      .post("/api/vehicles")
      .set(headers)
      .send(vehicleBody);
    expect(duplicateVehicle.status).toBe(409);
    expect(duplicateVehicle.body.code).toBe("VEHICLE_IDENTIFIER_EXISTS");
    expect(duplicateVehicle.body.message).toBe(
      "Vehicle identifier already exists",
    );

    const firstDevice = await request(db.app)
      .post("/api/devices")
      .set(headers)
      .send(deviceBody);
    expect(firstDevice.status).toBe(201);
    const duplicateDevice = await request(db.app)
      .post("/api/devices")
      .set(headers)
      .send(deviceBody);
    expect(duplicateDevice.status).toBe(409);
    expect(duplicateDevice.body.code).toBe("DEVICE_IDENTIFIER_EXISTS");
    expect(duplicateDevice.body.message).toBe(
      "Device identifier already exists",
    );

    const concurrentVehicleRequests = await Promise.all([
      request(db.app)
        .post("/api/vehicles")
        .set(headers)
        .send({
          ...vehicleBody,
          plateNumber: "LM-654",
        }),
      request(db.app)
        .post("/api/vehicles")
        .set(headers)
        .send({
          ...vehicleBody,
          plateNumber: "LM-654",
        }),
    ]);
    expect(
      concurrentVehicleRequests.map((response) => response.status).sort(),
    ).toEqual([201, 409]);

    const concurrentDeviceRequests = await Promise.all([
      request(db.app)
        .post("/api/devices")
        .set(headers)
        .send({ identifier: "GPS-RACE", status: "active" }),
      request(db.app)
        .post("/api/devices")
        .set(headers)
        .send({ identifier: "GPS-RACE", status: "active" }),
    ]);
    expect(
      concurrentDeviceRequests.map((response) => response.status).sort(),
    ).toEqual([201, 409]);
  });

  it("hides unexpected server errors behind the standardized response", async () => {
    const db = createDatabase();
    db.failDeviceList();
    const response = await request(db.app)
      .get("/api/devices")
      .set("Authorization", db.auth);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "private database detail",
    );
  });

  it("validates IDs and returns 404 for missing records", async () => {
    const db = createDatabase();
    const invalid = await request(db.app)
      .get("/api/devices/not-a-uuid")
      .set("Authorization", db.auth);
    expect(invalid.status).toBe(400);

    const invalidVehicleUpdate = await request(db.app)
      .put("/api/vehicles/not-a-uuid")
      .set("Authorization", db.auth)
      .send({
        plateNumber: "AB-456",
        make: "Ford",
        model: "Transit",
        year: 2024,
      });
    expect(invalidVehicleUpdate.status).toBe(400);

    const invalidDeviceUpdate = await request(db.app)
      .put("/api/devices/not-a-uuid")
      .set("Authorization", db.auth)
      .send({ identifier: "GPS-003" });
    expect(invalidDeviceUpdate.status).toBe(400);

    const missingDevice = await request(db.app)
      .get(`/api/devices/${randomUUID()}`)
      .set("Authorization", db.auth);
    expect(missingDevice.status).toBe(404);

    const missingVehicle = await request(db.app)
      .get(`/api/vehicles/${randomUUID()}`)
      .set("Authorization", db.auth);
    expect(missingVehicle.status).toBe(404);

    const missingVehicleUpdate = await request(db.app)
      .put(`/api/vehicles/${randomUUID()}`)
      .set("Authorization", db.auth)
      .send({
        plateNumber: "AB-456",
        make: "Ford",
        model: "Transit",
        year: 2024,
      });
    expect(missingVehicleUpdate.status).toBe(404);

    const missingDeviceUpdate = await request(db.app)
      .put(`/api/devices/${randomUUID()}`)
      .set("Authorization", db.auth)
      .send({ identifier: "GPS-003" });
    expect(missingDeviceUpdate.status).toBe(404);
  });

  it("allows only approved master fields and preserves history during PUT", async () => {
    const db = createDatabase();
    const historyBefore = JSON.stringify(db.historyRows);
    const telemetryBefore = JSON.stringify(db.telemetryRows);

    const vehicleResponse = await request(db.app)
      .put(`/api/vehicles/${db.vehicle.id}`)
      .set("Authorization", db.auth)
      .send({
        plateNumber: "  cd-456 ",
        make: "Updated Make",
        model: "Updated Model",
        year: 2025,
        status: "maintenance",
      });
    expect(vehicleResponse.status).toBe(200);
    expect(vehicleResponse.body.data.plateNumber).toBe("CD-456");

    const deviceResponse = await request(db.app)
      .put(`/api/devices/${db.device.id}`)
      .set("Authorization", db.auth)
      .send({
        identifier: " GPS-002 ",
        vehicleId: db.vehicle.id,
        status: "inactive",
      });
    expect(deviceResponse.status).toBe(200);
    expect(deviceResponse.body.data.identifier).toBe("GPS-002");
    expect(deviceResponse.body.data.lastSeenAt).toBe(
      "2026-01-02T00:00:00.000Z",
    );

    expect(JSON.stringify(db.historyRows)).toBe(historyBefore);
    expect(JSON.stringify(db.telemetryRows)).toBe(telemetryBefore);
    expect(db.queriedEntities).not.toContain(LocationHistory);
    expect(db.queriedEntities).not.toContain(TelemetryEvent);
  });

  it("rejects missing, malformed, and unapproved update fields", async () => {
    const db = createDatabase();
    const vehicleUrl = `/api/vehicles/${db.vehicle.id}`;
    const deviceUrl = `/api/devices/${db.device.id}`;

    for (const body of [
      {
        plateNumber: "AA-1",
        make: "Ford",
        model: "Van",
        year: 2024,
        id: randomUUID(),
      },
      { plateNumber: "AA-1", make: "Ford", model: "Van" },
      { plateNumber: "  ", make: "Ford", model: "Van", year: 2024 },
      { plateNumber: "AA-1", make: "Ford", model: "Van", year: 1800 },
      {
        plateNumber: "AA-1",
        make: "Ford",
        model: "Van",
        year: 2024,
        status: "broken",
      },
    ]) {
      expect(
        (
          await request(db.app)
            .put(vehicleUrl)
            .set("Authorization", db.auth)
            .send(body)
        ).status,
      ).toBe(400);
    }

    for (const body of [
      { identifier: " " },
      { identifier: "GPS-2", status: "broken" },
      { identifier: "GPS-2", lastSeenAt: "2026-01-03T00:00:00.000Z" },
      { status: "inactive" },
    ]) {
      expect(
        (
          await request(db.app)
            .put(deviceUrl)
            .set("Authorization", db.auth)
            .send(body)
        ).status,
      ).toBe(400);
    }
  });

  it("returns conflict for duplicate master keys and checks assigned vehicles", async () => {
    const db = createDatabase();
    const duplicatePlate = await request(db.app)
      .put(`/api/vehicles/${db.vehicle.id}`)
      .set("Authorization", db.auth)
      .send({
        plateNumber: "XY-789",
        make: "Ford",
        model: "Transit",
        year: 2024,
      });
    expect(duplicatePlate.status).toBe(409);

    const duplicateIdentifier = await request(db.app)
      .put(`/api/devices/${db.device.id}`)
      .set("Authorization", db.auth)
      .send({ identifier: "GPS-002" });
    expect(duplicateIdentifier.status).toBe(409);

    const invalidVehicle = await request(db.app)
      .put(`/api/devices/${db.device.id}`)
      .set("Authorization", db.auth)
      .send({
        identifier: "GPS-003",
        vehicleId: randomUUID(),
      });
    expect(invalidVehicle.status).toBe(404);
  });
});
