// PostgreSQL integration tests for GPS ingestion: real SQL, real transactions, real
// concurrency. Opt-in via TEST_DATABASE_URL (see postgres-test-database.ts).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "@jest/globals";
import type { EntityManager } from "@mikro-orm/postgresql";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createAccessToken } from "../../src/modules/auth/auth.service.js";
import type { RealtimePublisher } from "../../src/modules/realtime/realtime.service.js";
import type { VehicleLocationPayload } from "../../src/modules/realtime/socket.events.js";
import { getLatestLocations } from "../../src/modules/tracking/latest-location.service.js";
import {
  createLocationHistory,
  upsertLatestLocation,
} from "../../src/modules/tracking/tracking.repository.js";
import type { TrackingLocationInput } from "../../src/modules/tracking/tracking.schema.js";
import { ingestLocation } from "../../src/modules/tracking/tracking.service.js";
import {
  createTestDatabase,
  describeWithDatabase,
  type TestDatabase,
} from "./postgres-test-database.js";

describeWithDatabase("tracking ingestion on PostgreSQL", () => {
  let db: TestDatabase;
  const fork = (): EntityManager => db.orm.em.fork();

  beforeAll(async () => {
    db = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  }, 60_000);

  async function seedVehicleWithDevices(deviceCount = 1) {
    const em = fork();
    const suffix = randomUUID().slice(0, 8);
    const [vehicle] = await em.execute<{ id: string }[]>(
      `INSERT INTO vehicles (plate_number, make, model, year)
       VALUES (?, 'Toyota', 'Innova', 2024) RETURNING id`,
      [`IT-${suffix}`],
    );
    const identifiers: string[] = [];
    const deviceIds: string[] = [];
    for (let i = 0; i < deviceCount; i++) {
      const identifier = `IT-GPS-${suffix}-${i}`;
      const [device] = await em.execute<{ id: string }[]>(
        `INSERT INTO devices (identifier, vehicle_id, status)
         VALUES (?, ?, 'active') RETURNING id`,
        [identifier, vehicle.id],
      );
      identifiers.push(identifier);
      deviceIds.push(device.id);
    }
    return { vehicleId: vehicle.id, identifiers, deviceIds };
  }

  function reading(
    deviceIdentifier: string,
    recordedAt: string,
    latitude = 9.93,
  ): TrackingLocationInput {
    return {
      deviceIdentifier,
      recordedAt: new Date(recordedAt),
      latitude,
      longitude: 76.26,
      speed: 40,
      heading: 90,
      altitude: 7,
    };
  }

  async function historyCount(vehicleId: string, em = fork()) {
    const [row] = await em.execute<{ n: number }[]>(
      "SELECT count(*)::int AS n FROM location_history WHERE vehicle_id = ?",
      [vehicleId],
    );
    return row.n;
  }

  async function liveRecordedAt(vehicleId: string, em = fork()) {
    const [row] = await em.execute<{ recorded_at: string }[]>(
      `SELECT to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS recorded_at
       FROM latest_locations WHERE vehicle_id = ?`,
      [vehicleId],
    );
    return row?.recorded_at ?? null;
  }

  it("commits the history row and the live position together", async () => {
    const { vehicleId, identifiers } = await seedVehicleWithDevices();
    const result = await ingestLocation(
      fork(),
      reading(identifiers[0], "2026-10-01T10:00:00.000Z"),
    );

    expect(result).toMatchObject({ duplicate: false, latestUpdated: true });
    expect(await historyCount(vehicleId)).toBe(1);
    expect(await liveRecordedAt(vehicleId)).toBe("2026-10-01T10:00:00.000Z");
  });

  it("rolls back both writes when the transaction fails after the live-position upsert", async () => {
    const { vehicleId, deviceIds } = await seedVehicleWithDevices();
    const { deviceIdentifier: _id, ...input } = reading(
      "unused",
      "2026-10-01T11:00:00.000Z",
    );

    await expect(
      fork().transactional(async (tx) => {
        await createLocationHistory(tx, input, deviceIds[0], vehicleId);
        expect(await upsertLatestLocation(tx, input, vehicleId)).toBe(true);
        // Visible inside the transaction, invisible to another connection: the
        // upsert really joined the surrounding transaction.
        expect(await liveRecordedAt(vehicleId, tx)).toBe(
          "2026-10-01T11:00:00.000Z",
        );
        expect(await liveRecordedAt(vehicleId)).toBeNull();
        throw new Error("fail after upsert");
      }),
    ).rejects.toThrow("fail after upsert");

    expect(await historyCount(vehicleId)).toBe(0);
    expect(await liveRecordedAt(vehicleId)).toBeNull();
  });

  it("rolls back the history row when the live-position write itself fails", async () => {
    const { vehicleId, identifiers } = await seedVehicleWithDevices();
    const em = fork();
    await em.execute(
      `CREATE OR REPLACE FUNCTION it_fail_latest() RETURNS trigger AS $$
       BEGIN RAISE EXCEPTION 'simulated latest_locations failure'; END $$ LANGUAGE plpgsql`,
    );
    await em.execute(
      `CREATE TRIGGER it_fail_latest BEFORE INSERT OR UPDATE ON latest_locations
       FOR EACH ROW EXECUTE FUNCTION it_fail_latest()`,
    );
    try {
      await expect(
        ingestLocation(
          fork(),
          reading(identifiers[0], "2026-10-01T12:00:00.000Z"),
        ),
      ).rejects.toThrow("simulated latest_locations failure");
    } finally {
      await em.execute("DROP TRIGGER it_fail_latest ON latest_locations");
    }

    expect(await historyCount(vehicleId)).toBe(0);
    expect(await liveRecordedAt(vehicleId)).toBeNull();
  });

  it("stores one row for concurrent identical readings (unique index + duplicate handling)", async () => {
    const { vehicleId, identifiers } = await seedVehicleWithDevices();
    const same = () => reading(identifiers[0], "2026-10-01T13:00:00.000Z");

    const results = await Promise.all(
      Array.from({ length: 10 }, () => ingestLocation(fork(), same())),
    );

    const created = results.filter((result) => !result.duplicate);
    expect(created).toHaveLength(1);
    expect(created[0].latestUpdated).toBe(true);
    expect(
      results.filter((result) => result.duplicate && !result.latestUpdated),
    ).toHaveLength(9);
    expect(new Set(results.map((result) => result.location.id)).size).toBe(1);
    expect(await historyCount(vehicleId)).toBe(1);
  });

  it("keeps the newest reading as the live position under concurrent different timestamps", async () => {
    const { vehicleId, identifiers } = await seedVehicleWithDevices();
    const timestamps = Array.from(
      { length: 20 },
      (_, i) => `2026-10-01T14:${String(i).padStart(2, "0")}:00.000Z`,
    );
    // Arrive in a scrambled order, all at once.
    const scrambled = [...timestamps].sort(() => Math.random() - 0.5);

    const results = await Promise.all(
      scrambled.map((at) =>
        ingestLocation(fork(), reading(identifiers[0], at)),
      ),
    );

    const newest = timestamps[timestamps.length - 1];
    expect(results.every((result) => !result.duplicate)).toBe(true);
    expect(await historyCount(vehicleId)).toBe(20);
    expect(await liveRecordedAt(vehicleId)).toBe(newest);
    const newestResult = results[scrambled.indexOf(newest)];
    expect(newestResult.latestUpdated).toBe(true);
  });

  it("never moves the live position backwards or for an equal timestamp from another device", async () => {
    const { vehicleId, identifiers } = await seedVehicleWithDevices(2);

    const newer = await ingestLocation(
      fork(),
      reading(identifiers[0], "2026-10-01T15:00:00.000Z", 1),
    );
    const older = await ingestLocation(
      fork(),
      reading(identifiers[0], "2026-10-01T14:59:00.000Z", 2),
    );
    const sameInstantOtherDevice = await ingestLocation(
      fork(),
      reading(identifiers[1], "2026-10-01T15:00:00.000Z", 3),
    );

    expect(newer.latestUpdated).toBe(true);
    expect(older).toMatchObject({ duplicate: false, latestUpdated: false });
    expect(sameInstantOtherDevice).toMatchObject({
      duplicate: false,
      latestUpdated: false,
    });
    expect(await historyCount(vehicleId)).toBe(3);
    const [live] = await getLatestLocations(fork(), [vehicleId]);
    expect(live).toMatchObject({ vehicleId, latitude: 1 });
  });

  describeWithDatabase("HTTP + realtime publisher on PostgreSQL", () => {
    async function appWithPublisher() {
      const events: VehicleLocationPayload[] = [];
      const publisher: RealtimePublisher = {
        publishVehicleLocation: (payload) => events.push(payload),
        disconnectToken: () => {},
      };
      const em = fork();
      const [admin] = await em.execute<
        { id: string; email: string; role: "super_admin" | "admin" }[]
      >(
        `INSERT INTO admins (email, password_hash, name, role, is_active)
         VALUES (?, 'unused', 'IT Admin', 'super_admin', true)
         RETURNING id, email, role`,
        [`it-${randomUUID()}@example.test`],
      );
      const app = createApp(db.orm, undefined, publisher);
      const auth = `Bearer ${createAccessToken(admin).token}`;
      return { app, auth, events };
    }

    it("publishes only committed readings that moved the live position", async () => {
      const { vehicleId, identifiers } = await seedVehicleWithDevices();
      const { app, auth, events } = await appWithPublisher();
      const post = (recordedAt: string) =>
        request(app)
          .post("/api/v1/tracking/ingest")
          .set("Authorization", auth)
          .send({
            deviceIdentifier: identifiers[0],
            recordedAt,
            latitude: 9.93,
            longitude: 76.26,
          });

      const first = await post("2026-10-01T16:00:00.000Z");
      expect(first.status).toBe(201);
      expect(events.map((event) => event.locationId)).toEqual([
        first.body.data.id,
      ]);

      expect((await post("2026-10-01T16:00:00.000Z")).status).toBe(200); // duplicate
      expect((await post("2026-10-01T15:00:00.000Z")).status).toBe(201); // older
      expect(events).toHaveLength(1);

      // Failed transaction: no event, and the history row is rolled back.
      const em = fork();
      await em.execute(
        `CREATE OR REPLACE FUNCTION it_fail_latest() RETURNS trigger AS $$
         BEGIN RAISE EXCEPTION 'simulated latest_locations failure'; END $$ LANGUAGE plpgsql`,
      );
      await em.execute(
        `CREATE TRIGGER it_fail_latest BEFORE INSERT OR UPDATE ON latest_locations
         FOR EACH ROW EXECUTE FUNCTION it_fail_latest()`,
      );
      const originalError = console.error;
      console.error = () => {};
      let failed: request.Response;
      try {
        failed = await post("2026-10-01T17:00:00.000Z");
      } finally {
        console.error = originalError;
        await em.execute("DROP TRIGGER it_fail_latest ON latest_locations");
      }
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(events).toHaveLength(1);
      expect(await historyCount(vehicleId)).toBe(2);
      expect(await liveRecordedAt(vehicleId)).toBe("2026-10-01T16:00:00.000Z");
    });

    it("serves POST /api/v1/tracking/latest from latest_locations", async () => {
      const { vehicleId, identifiers } = await seedVehicleWithDevices();
      await ingestLocation(
        fork(),
        reading(identifiers[0], "2026-10-01T18:00:00.000Z"),
      );
      const { app, auth } = await appWithPublisher();
      const unknown = Array.from({ length: 499 }, () => randomUUID());

      const response = await request(app)
        .post("/api/v1/tracking/latest")
        .set("Authorization", auth)
        .send({ vehicleIds: [...unknown, vehicleId.toUpperCase()] });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        {
          vehicleId,
          latitude: 9.93,
          longitude: 76.26,
          speed: 40,
          heading: 90,
          recordedAt: "2026-10-01T18:00:00.000Z",
          updatedAt: expect.any(String),
        },
      ]);
    });
  });
});
