// Socket.IO realtime: authentication, subscriptions, vehicle:location broadcast, logout
// and token-expiry disconnects, and the GET /api/v1/tracking/latest catch-up endpoint.
import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "@jest/globals";
import { type Socket as ClientSocket, io as connect } from "socket.io-client";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.entity.js";
import {
  createAccessToken,
  verifyAccessToken,
} from "../../src/modules/auth/auth.service.js";
import { RevokedToken } from "../../src/modules/auth/revoked-token.entity.js";
import { Device } from "../../src/modules/devices/device.entity.js";
import type { RealtimePublisher } from "../../src/modules/realtime/realtime.service.js";
import type {
  SessionEndedPayload,
  SubscriptionAck,
  VehicleLocationPayload,
} from "../../src/modules/realtime/socket.events.js";
import type { SocketLimits } from "../../src/modules/realtime/socket.rate-limit.js";
import { createSocketServer } from "../../src/modules/realtime/socket.server.js";
import { LatestLocation } from "../../src/modules/tracking/latest-location.entity.js";
import { LocationHistory } from "../../src/modules/tracking/location.entity.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

type Row = Record<string, unknown>;
type EntityClass = abstract new (...args: never[]) => object;

const vehicleA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const vehicleB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (
      typeof expected === "object" &&
      expected !== null &&
      "$in" in expected
    ) {
      return (expected.$in as unknown[]).includes(actual);
    }
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() === expected.getTime();
    }
    return actual === expected;
  });
}

/** In-memory stand-in for the MikroORM EntityManager calls these flows make. */
function createDatabase() {
  const admin = Object.assign(new Admin(), {
    id: randomUUID(),
    email: "admin@example.com",
    name: "Fleet Admin",
    role: "super_admin" as const,
    isActive: true,
    passwordHash: "unused",
  });
  const tables = new Map<EntityClass, Row[]>([
    [Admin, [admin as unknown as Row]],
    [RevokedToken, []],
    [
      Vehicle,
      [
        { id: vehicleA, plateNumber: "AA-1" },
        { id: vehicleB, plateNumber: "BB-2" },
      ],
    ],
    [
      Device,
      [
        { id: randomUUID(), identifier: "GPS-A", vehicleId: vehicleA },
        { id: randomUUID(), identifier: "GPS-B", vehicleId: vehicleB },
      ],
    ],
    [LocationHistory, []],
    [LatestLocation, []],
  ]);
  const rows = (entity: EntityClass) => tables.get(entity) ?? [];
  let pending: Row[] = [];
  // Simulates a database outage for every read (connection refused, pool exhausted...).
  // failLatestWrite: the live-position upsert fails after the history row was written.
  const status = { down: false, failLatestWrite: false };
  const ensureUp = () => {
    if (status.down) throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
  };

  const em = {
    async findOne(entity: EntityClass, where: Row) {
      ensureUp();
      return rows(entity).find((row) => matches(row, where)) ?? null;
    },
    async find(entity: EntityClass, where: Row) {
      ensureUp();
      return rows(entity).filter((row) => matches(row, where));
    },
    async insert(entity: EntityClass, data: Row) {
      rows(entity).push(data);
    },
    async nativeDelete() {
      return 0;
    },
    // `unknown`, not `typeof em`: referencing `em` in its own type makes it implicitly any.
    // Rolls back like a real transaction: restores both tracking tables on error.
    transactional<T>(callback: (tx: unknown) => Promise<T>) {
      const snapshot = [LocationHistory, LatestLocation].map(
        (entity) => [entity, rows(entity).map((row) => ({ ...row }))] as const,
      );
      return callback(em).catch((error: unknown) => {
        for (const [entity, saved] of snapshot) {
          rows(entity).splice(0, rows(entity).length, ...saved);
        }
        pending = [];
        throw error;
      });
    },
    create(entity: EntityClass, input: Row) {
      return Object.assign(Object.create(entity.prototype), {
        id: randomUUID(),
        ...input,
      });
    },
    persist(row: Row) {
      pending.push(row);
    },
    async flush() {
      rows(LocationHistory).push(...pending);
      pending = [];
    },
    // The latest_locations upsert: returns a row only when inserted or advanced.
    async execute(_sql: string, params: unknown[]) {
      if (status.failLatestWrite) throw new Error("deadlock detected");
      const [vehicleId, latitude, longitude, speed, heading, recordedAt] =
        params as [string, number, number, number, number, Date];
      const latest = rows(LatestLocation);
      const existing = latest.find((row) => row.vehicleId === vehicleId);
      if (existing && (existing.recordedAt as Date) >= recordedAt) return [];
      const values = { latitude, longitude, speed, heading, recordedAt };
      if (existing) Object.assign(existing, values, { updatedAt: new Date() });
      else latest.push({ vehicleId, ...values, updatedAt: new Date() });
      return [{ vehicle_id: vehicleId }];
    },
  };
  return { em, admin, tables, rows, status };
}

const servers: { http: HttpServer; close: () => Promise<void> }[] = [];
const clients: ClientSocket[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of servers.splice(0)) await server.close();
});

/** Real HTTP + Socket.IO server wired exactly like src/server.ts, on a random port. */
async function startServer(limits?: Partial<SocketLimits>) {
  const db = createDatabase();
  const orm = { em: { fork: () => db.em } };
  const app = createApp(orm as never);
  const http = createServer(app);
  // Counts every database access made by the Socket.IO layer.
  const socketDb = { accesses: 0 };
  const { io, realtime } = createSocketServer(
    http,
    () => {
      socketDb.accesses += 1;
      return db.em as never;
    },
    {
      connectionsPerMinute: 30,
      maxConnectionsPerIp: 20,
      subscriptionsPerMinute: 30,
      ...limits,
    },
  );
  app.locals.realtime = realtime;
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const close = () => new Promise<void>((resolve) => io.close(() => resolve()));
  servers.push({ http, close });

  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  const token = createAccessToken(db.admin);
  return { db, app, http, url, socketDb, token, auth: `Bearer ${token.token}` };
}

function openSocket(url: string, token?: string): ClientSocket {
  const socket = connect(url, {
    auth: token === undefined ? {} : { token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  return socket;
}

function connected(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
}

function connectError(socket: ClientSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => reject(new Error("unexpectedly connected")));
    socket.once("connect_error", (error) => resolve(error.message));
  });
}

function subscribe(socket: ClientSocket, vehicleIds: unknown) {
  return socket.emitWithAck("vehicles:subscribe", {
    vehicleIds,
  }) as Promise<SubscriptionAck>;
}

/** Collects events of one type so tests can assert what did (and didn't) arrive. */
function collect<T>(socket: ClientSocket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

const settle = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

function ingest(
  server: Awaited<ReturnType<typeof startServer>>,
  body: Record<string, unknown>,
) {
  return request(server.app)
    .post("/api/v1/tracking/ingest")
    .set("Authorization", server.auth)
    .send(body);
}

const reading = (deviceIdentifier: string, recordedAt: string) => ({
  deviceIdentifier,
  recordedAt,
  latitude: 9.9312,
  longitude: 76.2673,
  speed: 42,
  heading: 90,
  altitude: 7,
});

describe("Socket.IO authentication", () => {
  it("rejects connections without a valid, unrevoked admin token", async () => {
    const server = await startServer();
    expect(await connectError(openSocket(server.url))).toBe("UNAUTHORIZED");
    expect(await connectError(openSocket(server.url, "not-a-jwt"))).toBe(
      "UNAUTHORIZED",
    );

    const revoked = createAccessToken(server.db.admin);
    server.db.rows(RevokedToken).push({ id: revoked.tokenId });
    expect(await connectError(openSocket(server.url, revoked.token))).toBe(
      "UNAUTHORIZED",
    );

    server.db.admin.isActive = false;
    expect(await connectError(openSocket(server.url, server.token.token))).toBe(
      "UNAUTHORIZED",
    );
  });

  it("accepts a valid token, with or without the Bearer prefix", async () => {
    const server = await startServer();
    await connected(openSocket(server.url, server.token.token));
    await connected(openSocket(server.url, server.auth));
  });
});

describe("vehicle subscriptions", () => {
  it("subscribes to existing vehicles and reports unknown ones", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    const missing = randomUUID();

    expect(await subscribe(socket, [vehicleA, missing])).toEqual({
      ok: true,
      subscribed: [vehicleA],
      unknown: [missing],
    });
    expect(await subscribe(socket, [vehicleB])).toEqual({
      ok: true,
      subscribed: [vehicleA, vehicleB],
      unknown: [],
    });
    expect(
      await socket.emitWithAck("vehicles:unsubscribe", {
        vehicleIds: [vehicleA],
      }),
    ).toEqual({ ok: true, subscribed: [vehicleB], unknown: [] });
  });

  it("rejects malformed subscription requests", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);

    for (const vehicleIds of [["not-a-uuid"], [], "nope", undefined, [42]]) {
      const ack = await subscribe(socket, vehicleIds);
      expect(ack).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
  });
});

describe("vehicle:location broadcast", () => {
  it("delivers a committed reading only to sockets subscribed to that vehicle", async () => {
    const server = await startServer();
    const watcherA = openSocket(server.url, server.token.token);
    const watcherB = openSocket(server.url, server.token.token);
    const idle = openSocket(server.url, server.token.token);
    await Promise.all([watcherA, watcherB, idle].map(connected));
    await subscribe(watcherA, [vehicleA]);
    await subscribe(watcherB, [vehicleB]);
    const receivedA = collect<VehicleLocationPayload>(
      watcherA,
      "vehicle:location",
    );
    const receivedB = collect<VehicleLocationPayload>(
      watcherB,
      "vehicle:location",
    );
    const receivedIdle = collect(idle, "vehicle:location");

    const response = await ingest(
      server,
      reading("GPS-A", "2026-10-01T10:00:00.000Z"),
    );
    expect(response.status).toBe(201);
    await settle();

    expect(receivedA).toEqual([
      {
        locationId: response.body.data.id,
        vehicleId: vehicleA,
        deviceId: server.db.rows(Device)[0].id,
        latitude: 9.9312,
        longitude: 76.2673,
        speed: 42,
        heading: 90,
        altitude: 7,
        recordedAt: "2026-10-01T10:00:00.000Z",
        ingestedAt: expect.any(String),
      },
    ]);
    expect(receivedB).toEqual([]);
    expect(receivedIdle).toEqual([]);
  });

  it("does not broadcast duplicates or older out-of-order readings", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    await subscribe(socket, [vehicleA]);
    const received = collect<VehicleLocationPayload>(
      socket,
      "vehicle:location",
    );

    const newest = reading("GPS-A", "2026-10-01T10:05:00.000Z");
    expect((await ingest(server, newest)).status).toBe(201);
    expect((await ingest(server, newest)).status).toBe(200); // duplicate
    const older = reading("GPS-A", "2026-10-01T10:01:00.000Z");
    expect((await ingest(server, older)).status).toBe(201); // stored in history
    await settle();

    expect(received.map((event) => event.recordedAt)).toEqual([
      "2026-10-01T10:05:00.000Z",
    ]);
    expect(server.db.rows(LocationHistory)).toHaveLength(2);
  });

  it("stops delivering after unsubscribe", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    await subscribe(socket, [vehicleA]);
    await socket.emitWithAck("vehicles:unsubscribe", {
      vehicleIds: [vehicleA],
    });
    const received = collect(socket, "vehicle:location");

    await ingest(server, reading("GPS-A", "2026-10-01T11:00:00.000Z"));
    await settle();
    expect(received).toEqual([]);
  });

  it("still answers 201 when the realtime broadcast throws", async () => {
    const db = createDatabase();
    const broken: RealtimePublisher = {
      publishVehicleLocation() {
        throw new Error("socket layer down");
      },
      disconnectToken() {},
    };
    const app = createApp(
      { em: { fork: () => db.em } } as never,
      undefined,
      broken,
    );
    const response = await request(app)
      .post("/api/v1/tracking/ingest")
      .set("Authorization", `Bearer ${createAccessToken(db.admin).token}`)
      .send(reading("GPS-A", "2026-10-01T12:00:00.000Z"));

    expect(response.status).toBe(201);
    expect(db.rows(LocationHistory)).toHaveLength(1);
  });
});

describe("session end", () => {
  it("closes sockets opened with a token when that token logs out", async () => {
    const server = await startServer();
    const sameToken = openSocket(server.url, server.token.token);
    const otherToken = openSocket(
      server.url,
      createAccessToken(server.db.admin).token,
    );
    await Promise.all([sameToken, otherToken].map(connected));
    const ended = collect<SessionEndedPayload>(sameToken, "session:ended");
    const disconnected = new Promise((resolve) =>
      sameToken.once("disconnect", resolve),
    );

    const logout = await request(server.app)
      .post("/api/v1/auth/logout")
      .set("Authorization", server.auth);
    expect(logout.status).toBe(204);
    await disconnected;

    expect(ended).toEqual([{ reason: "logged_out" }]);
    expect(otherToken.connected).toBe(true);
  });

  it("closes the socket when its access token expires", async () => {
    const server = await startServer();
    // Issued 3599 s ago with a 3600 s lifetime: expires in about one second.
    const nearlyExpired = createAccessToken(
      server.db.admin,
      Math.floor(Date.now() / 1000) - 3599,
    );
    const socket = openSocket(server.url, nearlyExpired.token);
    await connected(socket);
    const ended = collect<SessionEndedPayload>(socket, "session:ended");
    await new Promise((resolve) => socket.once("disconnect", resolve));

    expect(ended).toEqual([{ reason: "token_expired" }]);
  });

  it("refuses a subscription once the session is no longer valid", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    server.db.admin.isActive = false;

    expect(await subscribe(socket, [vehicleA])).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Unauthorized",
        retryable: false,
      },
    });
  });
});

describe("GET /api/v1/tracking/latest", () => {
  it("returns live positions for catch-up after a reconnect", async () => {
    const server = await startServer();
    await ingest(server, reading("GPS-A", "2026-10-01T10:00:00.000Z"));
    await ingest(server, reading("GPS-B", "2026-10-01T10:00:30.000Z"));
    const get = (query = "") =>
      request(server.app)
        .get(`/api/v1/tracking/latest${query}`)
        .set("Authorization", server.auth);

    const all = await get();
    expect(all.status).toBe(200);
    expect(all.body.data.map((row: Row) => row.vehicleId).sort()).toEqual([
      vehicleA,
      vehicleB,
    ]);

    const one = await get(`?vehicleIds=${vehicleB.toUpperCase()}`);
    expect(one.body.data).toEqual([
      {
        vehicleId: vehicleB,
        latitude: 9.9312,
        longitude: 76.2673,
        speed: 42,
        heading: 90,
        recordedAt: "2026-10-01T10:00:30.000Z",
        updatedAt: expect.any(String),
      },
    ]);
  });

  it("validates the query and requires authentication", async () => {
    const server = await startServer();
    const bad = await request(server.app)
      .get("/api/v1/tracking/latest?vehicleIds=nope")
      .set("Authorization", server.auth);
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("VALIDATION_ERROR");

    const unknownFilter = await request(server.app)
      .get("/api/v1/tracking/latest?limit=5")
      .set("Authorization", server.auth);
    expect(unknownFilter.status).toBe(400);

    expect(
      (await request(server.app).get("/api/v1/tracking/latest")).status,
    ).toBe(401);
  });
});

describe("R5: connection and subscription limits", () => {
  it("rejects invalid authentication promptly without touching the database", async () => {
    const server = await startServer();
    const [header, payload] = server.token.token.split(".");
    const forged = `${header}.${payload}.${"A".repeat(43)}`; // wrong signature
    const expired = createAccessToken(
      server.db.admin,
      Math.floor(Date.now() / 1000) - 7200,
    ).token;
    expect(verifyAccessToken(forged)).toBeUndefined();
    expect(verifyAccessToken(expired)).toBeUndefined();

    for (const token of [undefined, "", "garbage", forged, expired, " x y "]) {
      const started = Date.now();
      expect(await connectError(openSocket(server.url, token))).toBe(
        "UNAUTHORIZED",
      );
      expect(Date.now() - started).toBeLessThan(1000);
    }
    expect(server.socketDb.accesses).toBe(0);

    // Only a correctly signed, unexpired token reaches the admin/revocation lookup.
    await connected(openSocket(server.url, server.token.token));
    expect(server.socketDb.accesses).toBe(1);
  });

  it("limits connection attempts per IP before authentication", async () => {
    const server = await startServer({ connectionsPerMinute: 3 });
    for (let i = 0; i < 3; i++) {
      const socket = openSocket(server.url, server.token.token);
      await connected(socket);
      socket.disconnect();
    }
    const accessesBefore = server.socketDb.accesses;

    await expect(
      connected(openSocket(server.url, server.token.token)),
    ).rejects.toBeDefined();
    expect(server.socketDb.accesses).toBe(accessesBefore);

    // The engine refuses the handshake itself (HTTP 403, reason in the body).
    const refused = await request(server.http).get(
      "/socket.io/?EIO=4&transport=polling",
    );
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({
      code: 4,
      message: "TOO_MANY_CONNECTION_ATTEMPTS",
    });
  });

  it("caps open connections per IP and frees the slot on disconnect", async () => {
    const server = await startServer({ maxConnectionsPerIp: 2 });
    const first = openSocket(server.url, server.token.token);
    const second = openSocket(server.url, server.token.token);
    await Promise.all([first, second].map(connected));

    await expect(
      connected(openSocket(server.url, server.token.token)),
    ).rejects.toBeDefined();
    const refused = await request(server.http).get(
      "/socket.io/?EIO=4&transport=polling",
    );
    expect(refused.body.message).toBe("TOO_MANY_CONNECTIONS");

    first.disconnect();
    await settle(200);
    await connected(openSocket(server.url, server.token.token));
  });

  it("limits subscription requests per socket before any database access", async () => {
    const server = await startServer({ subscriptionsPerMinute: 3 });
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);

    expect((await subscribe(socket, [vehicleA])).ok).toBe(true);
    expect((await subscribe(socket, [vehicleB])).ok).toBe(true);
    expect(
      (
        (await socket.emitWithAck("vehicles:unsubscribe", {
          vehicleIds: [vehicleA],
        })) as SubscriptionAck
      ).ok,
    ).toBe(true);
    const accessesBefore = server.socketDb.accesses;

    expect(await subscribe(socket, [vehicleA])).toEqual({
      ok: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many subscription requests. Try again later.",
        retryable: true,
        retryAfterMs: 60_000,
      },
    });
    expect(server.socketDb.accesses).toBe(accessesBefore);

    // The limit is per socket: another connection is unaffected.
    const other = openSocket(server.url, server.token.token);
    await connected(other);
    expect((await subscribe(other, [vehicleA])).ok).toBe(true);
  });

  it("closes a connection that sends an oversized message", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    const closed = new Promise<string>((resolve) =>
      socket.once("disconnect", (reason) => resolve(reason)),
    );

    socket.emit("vehicles:subscribe", { vehicleIds: ["x".repeat(100_000)] });
    expect(await closed).toBe("transport close");
  });
});

describe("H1: database outage versus invalid authentication", () => {
  // Socket.IO's connect_error carries the server's `data` next to the message.
  function connectFailure(socket: ClientSocket) {
    return new Promise<{ message: string; data: unknown }>(
      (resolve, reject) => {
        socket.once("connect", () =>
          reject(new Error("unexpectedly connected")),
        );
        socket.once("connect_error", (error: Error & { data?: unknown }) =>
          resolve({ message: error.message, data: error.data }),
        );
      },
    );
  }

  function captureErrorLog() {
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    return { lines, restore: () => (console.error = original) };
  }

  it("reports SERVICE_UNAVAILABLE (retryable), not UNAUTHORIZED, when the check cannot run", async () => {
    const server = await startServer();
    server.db.status.down = true;
    const log = captureErrorLog();
    try {
      const failure = await connectFailure(
        openSocket(server.url, server.token.token),
      );
      expect(failure).toEqual({
        message: "SERVICE_UNAVAILABLE",
        data: {
          code: "SERVICE_UNAVAILABLE",
          retryable: true,
          retryAfterMs: 2000,
        },
      });
    } finally {
      log.restore();
    }

    // Logged for operators, without the token or the error's query details.
    expect(log.lines).toEqual([
      "Realtime handshake authentication failed: Error: connect ECONNREFUSED 10.0.0.5:5432",
    ]);
    expect(log.lines.join("\n")).not.toContain(server.token.token);
  });

  it("still reports UNAUTHORIZED (not retryable) for a bad token, even while the database is down", async () => {
    const server = await startServer();
    server.db.status.down = true;
    expect(await connectFailure(openSocket(server.url, "garbage"))).toEqual({
      message: "UNAUTHORIZED",
      data: { code: "UNAUTHORIZED", retryable: false },
    });

    server.db.status.down = false;
    server.db.admin.isActive = false;
    expect(
      await connectFailure(openSocket(server.url, server.token.token)),
    ).toEqual({
      message: "UNAUTHORIZED",
      data: { code: "UNAUTHORIZED", retryable: false },
    });
  });

  it("lets a client following the documented retry rule connect once the database recovers", async () => {
    const server = await startServer();
    server.db.status.down = true;
    const log = captureErrorLog();
    const socket = openSocket(server.url, server.token.token);
    const events: string[] = [];

    // The frontend rule from the API contract: retry retryable errors after
    // retryAfterMs (shortened here), log out only on non-retryable ones.
    const outcome = new Promise<string>((resolve) => {
      socket.on("connect", () => resolve("connected"));
      socket.on(
        "connect_error",
        (error: Error & { data?: { retryable?: boolean } }) => {
          events.push(error.message);
          if (!error.data?.retryable) {
            resolve("logged out");
            return;
          }
          if (events.length === 2) server.db.status.down = false; // DB recovers
          setTimeout(() => socket.connect(), 20);
        },
      );
    });
    try {
      expect(await outcome).toBe("connected");
    } finally {
      log.restore();
    }
    expect(events).toEqual(["SERVICE_UNAVAILABLE", "SERVICE_UNAVAILABLE"]);
    expect(socket.connected).toBe(true);
  });

  it("answers a subscribe during an outage with SERVICE_UNAVAILABLE and keeps the socket", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    const ended = collect(socket, "session:ended");

    server.db.status.down = true;
    const log = captureErrorLog();
    let ack: SubscriptionAck;
    try {
      ack = await subscribe(socket, [vehicleA]);
    } finally {
      log.restore();
    }
    expect(ack).toEqual({
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable. Retry shortly.",
        retryable: true,
        retryAfterMs: 2000,
      },
    });
    expect(log.lines).toHaveLength(1);

    await settle();
    expect(socket.connected).toBe(true);
    expect(ended).toEqual([]);

    server.db.status.down = false;
    expect((await subscribe(socket, [vehicleA])).ok).toBe(true);
  });

  it("returns non-retryable errors for invalid subscription input", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    expect(await subscribe(socket, ["not-a-uuid"])).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
  });
});

describe("H1: REST requests during a database outage", () => {
  it("answers 500 (not 401) when the auth check cannot reach the database", async () => {
    const server = await startServer();
    server.db.status.down = true;
    const original = console.error;
    console.error = () => {};
    try {
      const response = await request(server.app)
        .get("/api/v1/tracking/latest")
        .set("Authorization", server.auth);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      });
    } finally {
      console.error = original;
    }
  });
});

function quietErrors() {
  const original = console.error;
  console.error = () => {};
  return () => {
    console.error = original;
  };
}

describe("regression: failed transactions never produce realtime events", () => {
  it("publishes nothing and stores nothing when the live-position write fails", async () => {
    const server = await startServer();
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);
    await subscribe(socket, [vehicleA]);
    const received = collect<VehicleLocationPayload>(
      socket,
      "vehicle:location",
    );

    server.db.status.failLatestWrite = true;
    const restore = quietErrors();
    let failed: request.Response;
    try {
      failed = await ingest(
        server,
        reading("GPS-A", "2026-10-01T09:00:00.000Z"),
      );
    } finally {
      restore();
    }
    expect(failed.status).toBe(500);
    expect(failed.body.code).toBe("INTERNAL_SERVER_ERROR");
    await settle();
    expect(received).toEqual([]);
    // Rolled back: the history row written before the failure is gone too.
    expect(server.db.rows(LocationHistory)).toEqual([]);
    expect(server.db.rows(LatestLocation)).toEqual([]);

    // The same reading succeeds once the database recovers, and is published once.
    server.db.status.failLatestWrite = false;
    const retried = await ingest(
      server,
      reading("GPS-A", "2026-10-01T09:00:00.000Z"),
    );
    expect(retried.status).toBe(201);
    await settle();
    expect(received.map((event) => event.locationId)).toEqual([
      retried.body.data.id,
    ]);
  });
});

describe("regression: subscription cap (500 vehicles per socket)", () => {
  function addVehicles(
    server: Awaited<ReturnType<typeof startServer>>,
    count: number,
  ) {
    const ids = Array.from({ length: count }, () => randomUUID());
    server.db.rows(Vehicle).push(...ids.map((id) => ({ id })));
    return ids;
  }

  it("allows exactly 500 vehicles and rejects one more", async () => {
    const server = await startServer();
    const ids = addVehicles(server, 501);
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);

    const full = await subscribe(socket, ids.slice(0, 500));
    expect(full.ok && full.subscribed.length).toBe(500);

    expect(await subscribe(socket, [ids[500]])).toEqual({
      ok: false,
      error: {
        code: "TOO_MANY_SUBSCRIPTIONS",
        message: "A connection can follow at most 500 vehicles",
        retryable: false,
      },
    });
    // Re-subscribing to a vehicle already followed, or to unknown IDs, adds nothing
    // and is still accepted at the cap.
    const again = await subscribe(socket, [ids[0], randomUUID()]);
    expect(again.ok && again.subscribed.length).toBe(500);
    expect(again.ok && again.unknown).toHaveLength(1);
  });

  it("cannot be exceeded by parallel subscribe requests", async () => {
    const server = await startServer();
    const ids = addVehicles(server, 600);
    const socket = openSocket(server.url, server.token.token);
    await connected(socket);

    const [first, second] = await Promise.all([
      subscribe(socket, ids.slice(0, 300)),
      subscribe(socket, ids.slice(300, 600)),
    ]);
    const outcomes = [first, second].map((ack) =>
      ack.ok ? "ok" : ack.error.code,
    );
    expect(outcomes.sort()).toEqual(["TOO_MANY_SUBSCRIPTIONS", "ok"]);

    const now = await socket.emitWithAck("vehicles:unsubscribe", {
      vehicleIds: [randomUUID()],
    });
    expect(now.ok && now.subscribed.length).toBe(300);
  });
});

describe("POST /api/v1/tracking/latest", () => {
  async function seeded() {
    const server = await startServer();
    await ingest(server, reading("GPS-A", "2026-10-01T10:00:00.000Z"));
    await ingest(server, reading("GPS-B", "2026-10-01T10:00:30.000Z"));
    const post = (body: unknown) =>
      request(server.app)
        .post("/api/v1/tracking/latest")
        .set("Authorization", server.auth)
        .send(body as object);
    return { server, post };
  }
  const unknownIds = (count: number) =>
    Array.from({ length: count }, () => randomUUID());

  it("accepts exactly 500 IDs and returns only vehicles that have a position", async () => {
    const { post } = await seeded();
    const response = await post({
      vehicleIds: [vehicleA, vehicleB, ...unknownIds(498)],
    });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.map((row: Row) => row.vehicleId)).toEqual([
      vehicleA,
      vehicleB,
    ]);
  });

  it("rejects 501 unique IDs", async () => {
    const { post } = await seeded();
    const response = await post({ vehicleIds: [vehicleA, ...unknownIds(500)] });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "vehicleIds must contain 1-500 vehicle UUIDs",
      code: "VALIDATION_ERROR",
    });
  });

  it("removes duplicates (case and whitespace insensitive) before applying the limit", async () => {
    const { post } = await seeded();
    const ids = [...unknownIds(499), vehicleB];
    const withDuplicates = [
      ...ids,
      ...ids.slice(0, 300),
      ` ${vehicleB.toUpperCase()} `,
    ];
    expect(withDuplicates).toHaveLength(801);
    const response = await post({ vehicleIds: withDuplicates });
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: Row) => row.vehicleId)).toEqual([
      vehicleB,
    ]);

    // Raw lists longer than 1000 entries are rejected even if mostly duplicates.
    const tooLong = await post({ vehicleIds: Array(1001).fill(vehicleA) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.message).toBe(
      "vehicleIds must contain at most 1000 entries",
    );
  });

  it("returns an empty list for unknown vehicle IDs", async () => {
    const { post } = await seeded();
    const response = await post({ vehicleIds: unknownIds(3) });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("rejects empty and malformed inputs with VALIDATION_ERROR", async () => {
    const { post } = await seeded();
    for (const body of [
      {},
      { vehicleIds: [] },
      { vehicleIds: [""] },
      { vehicleIds: ["  "] },
      { vehicleIds: "a,b" },
      { vehicleIds: [vehicleA, 7] },
      { vehicleIds: ["not-a-uuid"] },
      { vehicleIds: [vehicleA], limit: 5 },
      [vehicleA],
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        code: "VALIDATION_ERROR",
      });
    }
  });

  it("requires authentication and keeps GET working", async () => {
    const { server } = await seeded();
    expect(
      (
        await request(server.app)
          .post("/api/v1/tracking/latest")
          .send({ vehicleIds: [vehicleA] })
      ).status,
    ).toBe(401);
    const get = await request(server.app)
      .get(`/api/v1/tracking/latest?vehicleIds=${vehicleA}`)
      .set("Authorization", server.auth);
    expect(get.status).toBe(200);
    expect(get.body.data).toHaveLength(1);
  });
});
