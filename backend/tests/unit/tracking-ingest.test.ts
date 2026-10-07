// HTTP tests for normalized, authenticated location ingestion.
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
  | typeof Device
  | typeof Vehicle
  | typeof LocationHistory
  | typeof LatestLocation;

interface TestEntityManager {
  findOne(
    entity: EntityClass,
    where: Record<string, unknown>,
  ): Promise<object | null>;
  transactional<T>(
    callback: (transactionalEm: TestEntityManager) => Promise<T>,
  ): Promise<T>;
  create(entity: EntityClass, input: object): object;
  persist(entity: object): void;
  flush(): Promise<void>;
  upsert(
    entity: EntityClass,
    input: Record<string, unknown>,
    options: { onConflictFields: string[]; onConflictAction: "merge" },
  ): Promise<object>;
}

function createFixture(options?: {
  deviceVehicleId?: string | null;
  includeVehicle?: boolean;
  failFlush?: boolean;
  failLatestUpsert?: boolean;
}) {
  const vehicleId = randomUUID();
  const admin = Object.assign(new Admin(), {
    id: randomUUID(),
    email: "tracking-admin@example.com",
    name: "Tracking Admin",
    role: "admin" as const,
    isActive: true,
  });
  const vehicle = Object.assign(new Vehicle(), {
    id: vehicleId,
    plateNumber: "AB-123",
    make: "Ford",
    model: "Transit",
    year: 2025,
    status: "active" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const device = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "GPS-001",
    vehicleId:
      options && Object.hasOwn(options, "deviceVehicleId")
        ? options.deviceVehicleId
        : vehicleId,
    status: "active" as const,
    lastSeenAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const initialLivePosition = Object.assign(new LatestLocation(), {
    id: randomUUID(),
    vehicleId,
    latitude: 12.34,
    longitude: 56.78,
    speed: 5,
    heading: 90,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const tables = new Map<EntityClass, object[]>([
    [Admin, [admin]],
    [RevokedToken, []],
    [Device, [device]],
    [Vehicle, options?.includeVehicle === false ? [] : [vehicle]],
    [LocationHistory, []],
    [LatestLocation, [initialLivePosition]],
  ]);
  let failFlush = options?.failFlush ?? false;
  const failLatestUpsert = options?.failLatestUpsert ?? false;
  let pending: object[] = [];
  const em: TestEntityManager = {
    async findOne(entity: EntityClass, where: Record<string, unknown>) {
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
    transactional<T>(
      callback: (transactionalEm: TestEntityManager) => Promise<T>,
    ) {
      const snapshots = new Map(
        [...tables].map(([entity, rows]) => [
          entity,
          rows.map((row) => structuredClone(row)),
        ]),
      );
      return callback(em).catch((error: unknown) => {
        for (const [entity, rows] of snapshots) {
          const currentRows = tables.get(entity);
          currentRows?.splice(0, currentRows.length, ...rows);
        }
        pending = [];
        throw error;
      });
    },
    create(entity: EntityClass, input: object) {
      return Object.assign(Object.create(entity.prototype), {
        id: randomUUID(),
        ...input,
      });
    },
    persist(entity: object) {
      pending.push(entity);
    },
    async flush() {
      if (failFlush) throw new Error("private database failure");
      tables.get(LocationHistory)?.push(...pending);
      pending = [];
    },
    async upsert(
      entity: EntityClass,
      input: Record<string, unknown>,
      _options: { onConflictFields: string[]; onConflictAction: "merge" },
    ) {
      if (failLatestUpsert) throw new Error("private latest-position failure");
      const rows = tables.get(entity);
      const existing = rows?.find(
        (row) => (row as Record<string, unknown>).vehicleId === input.vehicleId,
      );
      if (existing) return Object.assign(existing, input);

      const created = Object.assign({ id: randomUUID() }, input);
      rows?.push(created);
      return created;
    },
  };
  const app = createApp({ em: { fork: () => em } } as never);

  return {
    app,
    auth: `Bearer ${createAccessToken(admin).token}`,
    device,
    vehicle,
    storedLocations: tables.get(LocationHistory) ?? [],
    livePositions: tables.get(LatestLocation) ?? [],
    initialLivePosition: structuredClone(initialLivePosition),
    failFlush() {
      failFlush = true;
    },
  };
}

const validLocation = {
  deviceIdentifier: " GPS-001 ",
  recordedAt: "2026-10-07T05:20:00.000Z",
  latitude: 51.5072,
  longitude: -0.1276,
  speed: 32.5,
  heading: 180,
  altitude: 15,
};

describe("POST /api/v1/tracking/ingest", () => {
  it("stores valid location data against the resolved Device and Vehicle", async () => {
    const fixture = createFixture();
    const response = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", fixture.auth)
      .send(validLocation);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Location recorded successfully",
      data: {
        deviceId: fixture.device.id,
        vehicleId: fixture.vehicle.id,
        latitude: 51.5072,
        longitude: -0.1276,
        speed: 32.5,
        heading: 180,
        altitude: 15,
        recordedAt: "2026-10-07T05:20:00.000Z",
      },
    });
    expect(fixture.storedLocations).toHaveLength(1);
    expect(fixture.livePositions).toHaveLength(1);
    expect(fixture.livePositions[0]).toMatchObject({
      vehicleId: fixture.vehicle.id,
      latitude: 51.5072,
      longitude: -0.1276,
      speed: 32.5,
      heading: 180,
    });
  });

  it.each([
    ["southwest coordinate boundary", -90, -180],
    ["southeast coordinate boundary", -90, 180],
    ["northwest coordinate boundary", 90, -180],
    ["northeast coordinate boundary", 90, 180],
  ])(
    "accepts the %s and updates only the resolved Vehicle",
    async (_label, latitude, longitude) => {
      const fixture = createFixture();
      const response = await request(fixture.app)
        .post("/api/v1/tracking/ingest")
        .set("Authorization", fixture.auth)
        .send({ ...validLocation, latitude, longitude });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        deviceId: fixture.device.id,
        vehicleId: fixture.vehicle.id,
        latitude,
        longitude,
      });
      expect(fixture.livePositions[0]).toMatchObject({
        vehicleId: fixture.vehicle.id,
        latitude,
        longitude,
      });
    },
  );

  it.each([
    ["latitude below range", { ...validLocation, latitude: -90.01 }],
    ["latitude above range", { ...validLocation, latitude: 90.01 }],
    ["longitude below range", { ...validLocation, longitude: -180.01 }],
    ["longitude above range", { ...validLocation, longitude: 180.01 }],
    ["invalid timestamp", { ...validLocation, recordedAt: "not-a-date" }],
    ["missing identifier", { ...validLocation, deviceIdentifier: undefined }],
    ["missing timestamp", { ...validLocation, recordedAt: undefined }],
    ["missing latitude", { ...validLocation, latitude: undefined }],
    ["missing longitude", { ...validLocation, longitude: undefined }],
    ["invalid optional speed", { ...validLocation, speed: -1 }],
    ["invalid optional heading", { ...validLocation, heading: 361 }],
  ])("rejects %s without persisting a location", async (_label, body) => {
    const fixture = createFixture();
    const response = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", fixture.auth)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
    expect(fixture.storedLocations).toHaveLength(0);
    expect(fixture.livePositions).toEqual([fixture.initialLivePosition]);
  });

  it("rejects unknown, unassigned, and invalid Device associations", async () => {
    const unknownFixture = createFixture();
    const unknown = await request(unknownFixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", unknownFixture.auth)
      .send({ ...validLocation, deviceIdentifier: "UNKNOWN-DEVICE" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe("DEVICE_NOT_FOUND");
    expect(unknownFixture.storedLocations).toHaveLength(0);
    expect(unknownFixture.livePositions).toEqual([
      unknownFixture.initialLivePosition,
    ]);

    const unassignedFixture = createFixture({ deviceVehicleId: null });
    const unassigned = await request(unassignedFixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", unassignedFixture.auth)
      .send(validLocation);
    expect(unassigned.status).toBe(409);
    expect(unassigned.body.code).toBe("DEVICE_NOT_ASSIGNED");
    expect(unassignedFixture.storedLocations).toHaveLength(0);
    expect(unassignedFixture.livePositions).toEqual([
      unassignedFixture.initialLivePosition,
    ]);

    const invalidRelationshipFixture = createFixture({
      deviceVehicleId: randomUUID(),
      includeVehicle: false,
    });
    const invalidRelationship = await request(invalidRelationshipFixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", invalidRelationshipFixture.auth)
      .send(validLocation);
    expect(invalidRelationship.status).toBe(409);
    expect(invalidRelationship.body.code).toBe(
      "DEVICE_VEHICLE_ASSOCIATION_INVALID",
    );
    expect(invalidRelationshipFixture.storedLocations).toHaveLength(0);
    expect(invalidRelationshipFixture.livePositions).toEqual([
      invalidRelationshipFixture.initialLivePosition,
    ]);
  });

  it("requires valid administrator authentication", async () => {
    const fixture = createFixture();
    const noToken = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .send(validLocation);
    expect(noToken.status).toBe(401);
    expect(noToken.body.code).toBe("UNAUTHORIZED");

    const invalidToken = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", "Bearer invalid")
      .send(validLocation);
    expect(invalidToken.status).toBe(401);
    expect(invalidToken.body.code).toBe("UNAUTHORIZED");
    expect(fixture.storedLocations).toHaveLength(0);
    expect(fixture.livePositions).toEqual([fixture.initialLivePosition]);
  });

  it("rejects caller-supplied IDs instead of overriding the stored association", async () => {
    const fixture = createFixture();
    const response = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", fixture.auth)
      .send({ ...validLocation, vehicleId: randomUUID() });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(fixture.storedLocations).toHaveLength(0);
    expect(fixture.livePositions).toEqual([fixture.initialLivePosition]);
  });

  it("converts database failures to a safe 500 without persisting", async () => {
    const fixture = createFixture({ failFlush: true });
    const response = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", fixture.auth)
      .send(validLocation);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "private database failure",
    );
    expect(fixture.storedLocations).toHaveLength(0);
    expect(fixture.livePositions).toEqual([fixture.initialLivePosition]);
  });

  it("rolls back history when live-position persistence fails", async () => {
    const fixture = createFixture({ failLatestUpsert: true });
    const response = await request(fixture.app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", fixture.auth)
      .send(validLocation);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(fixture.storedLocations).toHaveLength(0);
    expect(fixture.livePositions).toEqual([fixture.initialLivePosition]);
  });
});
