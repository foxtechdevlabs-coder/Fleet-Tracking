// HTTP tests for filtered location reports.
import { randomUUID } from "node:crypto";
import { describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import { createAccessToken } from "../../src/modules/auth/auth.service.js";
import { RevokedToken } from "../../src/modules/auth/revoked-token.entity.js";
import { Device } from "../../src/modules/devices/device.entity.js";
import { LocationHistory } from "../../src/modules/tracking/location.entity.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

type EntityClass =
  | typeof Admin
  | typeof RevokedToken
  | typeof Device
  | typeof LocationHistory
  | typeof Vehicle;

function createDatabase(options?: {
  includeLocations?: boolean;
  failReportQuery?: boolean;
}) {
  const vehicle = Object.assign(new Vehicle(), { id: randomUUID() });
  const otherVehicle = Object.assign(new Vehicle(), { id: randomUUID() });
  const emptyVehicle = Object.assign(new Vehicle(), { id: randomUUID() });
  const device = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "REPORT-GPS-001",
    vehicleId: vehicle.id,
  });
  const otherDevice = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "REPORT-GPS-002",
    vehicleId: vehicle.id,
  });
  const otherVehicleDevice = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "REPORT-GPS-003",
    vehicleId: otherVehicle.id,
  });
  const emptyDevice = Object.assign(new Device(), {
    id: randomUUID(),
    identifier: "REPORT-GPS-EMPTY",
    vehicleId: otherVehicle.id,
  });
  const admin = Object.assign(new Admin(), {
    id: randomUUID(),
    email: "report-admin@example.com",
    name: "Report Admin",
    role: "admin" as const,
    isActive: true,
  });
  const location = (
    deviceId: string,
    vehicleId: string,
    recordedAt: string,
    fields: Record<string, unknown> = {},
  ) =>
    Object.assign(new LocationHistory(), {
      id: randomUUID(),
      deviceId,
      vehicleId,
      recordedAt: new Date(recordedAt),
      latitude: 8.0883,
      longitude: 77.5385,
      speed: 45.5,
      heading: 180,
      altitude: 15,
      ...fields,
    });
  const rows = [
    location(device.id, vehicle.id, "2026-01-01T00:00:00.000Z"),
    location(device.id, vehicle.id, "2026-01-02T00:00:00.000Z", {
      latitude: 90,
      longitude: -180,
      speed: null,
      heading: null,
      altitude: null,
    }),
    location(otherDevice.id, vehicle.id, "2026-01-02T12:00:00.000Z"),
    location(
      otherVehicleDevice.id,
      otherVehicle.id,
      "2026-01-03T00:00:00.000Z",
      {
        latitude: null,
        longitude: 181,
      },
    ),
  ];
  const tables = new Map<EntityClass, object[]>([
    [Admin, [admin]],
    [RevokedToken, []],
    [Vehicle, [vehicle, otherVehicle, emptyVehicle]],
    [Device, [device, otherDevice, otherVehicleDevice, emptyDevice]],
    [LocationHistory, options?.includeLocations === false ? [] : rows],
  ]);
  const reportQueries: Record<string, unknown>[] = [];
  const failReportQuery = options?.failReportQuery ?? false;
  const em = {
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
    async find(
      entity: EntityClass,
      where: Record<string, unknown>,
      queryOptions: { orderBy: { recordedAt: "ASC" } },
    ) {
      if (entity === LocationHistory && failReportQuery) {
        throw new Error("private report database details");
      }
      reportQueries.push(where);
      const matches = (tables.get(entity) ?? []).filter((row) =>
        Object.entries(where).every(([key, expected]) => {
          const actual = (row as Record<string, unknown>)[key];
          if (key === "recordedAt") {
            const time = (actual as Date).getTime();
            const range = expected as { $gte?: Date; $lte?: Date };
            return (
              (!range.$gte || time >= range.$gte.getTime()) &&
              (!range.$lte || time <= range.$lte.getTime())
            );
          }
          return actual === expected;
        }),
      );
      matches.sort(
        (a, b) =>
          ((a as LocationHistory).recordedAt.getTime() -
            (b as LocationHistory).recordedAt.getTime()) *
          (queryOptions.orderBy.recordedAt === "ASC" ? 1 : -1),
      );
      return matches;
    },
  };
  const app = createApp({ em: { fork: () => em } } as never);

  return {
    app,
    auth: `Bearer ${createAccessToken(admin).token}`,
    vehicle,
    otherVehicle,
    emptyVehicle,
    device,
    otherDevice,
    otherVehicleDevice,
    emptyDevice,
    rows,
    reportQueries,
  };
}

const start = "2026-01-02T00:00:00.000Z";
const end = "2026-01-02T23:59:59.999Z";

function getReport(
  app: ReturnType<typeof createDatabase>["app"],
  auth: string,
  query = "",
) {
  return request(app)
    .get(`/api/v1/reports/locations${query}`)
    .set("Authorization", auth);
}

describe("GET /api/v1/reports/locations", () => {
  it("preserves the unfiltered report behavior and requires authentication", async () => {
    const db = createDatabase();
    const unauthenticated = await request(db.app).get(
      "/api/v1/reports/locations",
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.code).toBe("UNAUTHORIZED");

    const response = await getReport(db.app, db.auth);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
  });

  it("returns an empty collection when no tracking data is stored", async () => {
    const db = createDatabase({ includeLocations: false });
    const response = await getReport(db.app, db.auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Location report retrieved successfully",
      data: [],
    });
  });

  it("applies inclusive date bounds in the database query", async () => {
    const db = createDatabase();
    const response = await getReport(
      db.app,
      db.auth,
      `?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(
      response.body.data.map((row: { recordedAt: string }) => row.recordedAt),
    ).toEqual(["2026-01-02T00:00:00.000Z", "2026-01-02T12:00:00.000Z"]);
    expect(db.reportQueries[0]).toEqual({
      recordedAt: { $gte: new Date(start), $lte: new Date(end) },
    });
  });

  it.each([
    ["invalid start date", `?from=${encodeURIComponent("not-a-date")}`],
    ["invalid end date", `?to=${encodeURIComponent("2026-02-30T00:00:00Z")}`],
    [
      "start after end",
      `?from=${encodeURIComponent(end)}&to=${encodeURIComponent(start)}`,
    ],
  ])("rejects %s", async (_label, query) => {
    const db = createDatabase();
    const response = await getReport(db.app, db.auth, query);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(db.reportQueries).toHaveLength(0);
  });

  it("returns an empty list when valid filters have no matching location", async () => {
    const db = createDatabase();
    const response = await getReport(
      db.app,
      db.auth,
      `?from=${encodeURIComponent("2027-01-01T00:00:00Z")}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("validates Vehicle and registered Device filters", async () => {
    const db = createDatabase();
    const vehicleReport = await getReport(
      db.app,
      db.auth,
      `?vehicleId=${db.vehicle.id}`,
    );
    expect(vehicleReport.status).toBe(200);
    expect(vehicleReport.body.data).toHaveLength(3);

    const emptyVehicleResponse = await getReport(
      db.app,
      db.auth,
      `?vehicleId=${db.emptyVehicle.id}`,
    );
    expect(emptyVehicleResponse.status).toBe(200);
    expect(emptyVehicleResponse.body.data).toEqual([]);

    const emptyDeviceOnVehicleResponse = await getReport(
      db.app,
      db.auth,
      `?vehicleId=${db.otherVehicle.id}&deviceIdentifier=${db.emptyDevice.identifier}`,
    );
    expect(emptyDeviceOnVehicleResponse.status).toBe(200);
    expect(emptyDeviceOnVehicleResponse.body.data).toEqual([]);

    const unknownVehicle = await getReport(
      db.app,
      db.auth,
      `?vehicleId=${randomUUID()}`,
    );
    expect(unknownVehicle.status).toBe(404);
    expect(unknownVehicle.body.code).toBe("VEHICLE_NOT_FOUND");

    const unknownDevice = await getReport(
      db.app,
      db.auth,
      "?deviceIdentifier=UNKNOWN-REPORT-DEVICE",
    );
    expect(unknownDevice.status).toBe(404);
    expect(unknownDevice.body.code).toBe("DEVICE_NOT_FOUND");

    const emptyDeviceReport = await getReport(
      db.app,
      db.auth,
      `?deviceIdentifier=${db.emptyDevice.identifier}`,
    );
    expect(emptyDeviceReport.status).toBe(200);
    expect(emptyDeviceReport.body.data).toEqual([]);
  });

  it.each([
    [
      "date and Vehicle",
      (db: ReturnType<typeof createDatabase>) =>
        `?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&vehicleId=${db.vehicle.id}`,
      2,
    ],
    [
      "date and Device",
      (db: ReturnType<typeof createDatabase>) =>
        `?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&deviceIdentifier=${db.device.identifier}`,
      1,
    ],
    [
      "Vehicle and Device",
      (db: ReturnType<typeof createDatabase>) =>
        `?vehicleId=${db.vehicle.id}&deviceIdentifier=${db.otherDevice.identifier}`,
      1,
    ],
    [
      "mismatched Vehicle and Device",
      (db: ReturnType<typeof createDatabase>) =>
        `?vehicleId=${db.otherVehicle.id}&deviceIdentifier=${db.otherDevice.identifier}`,
      0,
    ],
    [
      "date, Vehicle, and Device",
      (db: ReturnType<typeof createDatabase>) =>
        `?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&vehicleId=${db.vehicle.id}&deviceIdentifier=${db.device.identifier}`,
      1,
    ],
  ])(
    "combines %s filters with AND logic",
    async (_label, buildQuery, count) => {
      const db = createDatabase();
      const response = await getReport(db.app, db.auth, buildQuery(db));

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(count);
      const filters = new URLSearchParams(buildQuery(db).slice(1));
      for (const row of response.body.data) {
        const vehicleId = filters.get("vehicleId");
        if (vehicleId) expect(row.vehicleId).toBe(vehicleId);
        const from = filters.get("from");
        const to = filters.get("to");
        if (from)
          expect(new Date(row.recordedAt).getTime()).toBeGreaterThanOrEqual(
            new Date(from).getTime(),
          );
        if (to)
          expect(new Date(row.recordedAt).getTime()).toBeLessThanOrEqual(
            new Date(to).getTime(),
          );
        const identifier = filters.get("deviceIdentifier");
        if (identifier) {
          const expectedDevice = [
            db.device,
            db.otherDevice,
            db.otherVehicleDevice,
            db.emptyDevice,
          ].find((device) => device.identifier === identifier);
          expect(row.deviceId).toBe(expectedDevice?.id);
        }
      }
    },
  );

  it("preserves valid coordinate precision and does not invent optional telemetry", async () => {
    const db = createDatabase();
    const response = await getReport(
      db.app,
      db.auth,
      `?deviceIdentifier=${db.device.identifier}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      latitude: 8.0883,
      longitude: 77.5385,
      speed: 45.5,
      heading: 180,
      altitude: 15,
    });
    expect(response.body.data[1]).toMatchObject({
      latitude: 90,
      longitude: -180,
      speed: null,
      heading: null,
      altitude: null,
    });

    const invalidStoredLocation = await getReport(
      db.app,
      db.auth,
      `?deviceIdentifier=${db.otherVehicleDevice.identifier}`,
    );
    expect(invalidStoredLocation.body.data[0]).toMatchObject({
      latitude: null,
      longitude: null,
    });
  });

  it("returns ordered, export-ready rows with only approved report fields", async () => {
    const db = createDatabase();
    const response = await getReport(
      db.app,
      db.auth,
      `?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&vehicleId=${db.vehicle.id}&deviceIdentifier=${db.device.identifier}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(Object.keys(response.body.data[0])).toEqual([
      "recordedAt",
      "vehicleId",
      "deviceId",
      "latitude",
      "longitude",
      "speed",
      "heading",
      "altitude",
    ]);
    expect(response.body.data[0]).toEqual({
      recordedAt: "2026-01-02T00:00:00.000Z",
      vehicleId: db.vehicle.id,
      deviceId: db.device.id,
      latitude: 90,
      longitude: -180,
      speed: null,
      heading: null,
      altitude: null,
    });
    expect(response.body.data[0]).not.toHaveProperty("id");
    expect(response.body.data[0]).not.toHaveProperty("ingestedAt");
  });

  it("returns a safe error and logs repository failures", async () => {
    const db = createDatabase({ failReportQuery: true });
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await getReport(db.app, db.auth);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(JSON.stringify(response.body)).not.toContain(
        "private report database details",
      );
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
