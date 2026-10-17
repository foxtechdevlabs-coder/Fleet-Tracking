// Socket.IO server setup.
import type { Server as HttpServer } from "node:http";
import type { EntityManager } from "@mikro-orm/postgresql";
import { Server } from "socket.io";
import { AppError } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { authenticateAccessToken } from "../auth/auth.service.js";
import {
  maxVehicleIdsPerRequest,
  parseVehicleIdList,
} from "../tracking/tracking.schema.js";
import { Vehicle } from "../vehicles/vehicle.entity.js";
import {
  type AppSocketServer,
  createRealtimeService,
  type RealtimePublisher,
} from "./realtime.service.js";
import {
  type AppSocket,
  createSocketAuth,
  endSession,
  enforceTokenLifetime,
  handshakeToken,
  logRealtimeFailure,
} from "./socket.auth.js";
import {
  SocketEvents,
  type SubscriptionAck,
  serviceUnavailableError,
  unauthorizedError,
  vehicleRoom,
} from "./socket.events.js";
import {
  createConnectionGuard,
  FixedWindowCounter,
  type SocketLimits,
} from "./socket.rate-limit.js";

const subscriptionWindowMs = 60_000;

const tooManyRequests: SubscriptionAck = {
  ok: false,
  error: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many subscription requests. Try again later.",
    retryable: true,
    retryAfterMs: subscriptionWindowMs,
  },
};

function subscribedVehicles(socket: AppSocket): string[] {
  return [...socket.rooms]
    .filter((room) => room.startsWith("vehicle:"))
    .map((room) => room.slice("vehicle:".length));
}

/**
 * Client errors (4xx AppError: bad input, too many subscriptions) are not retryable.
 * Anything else is a server-side failure (e.g. database unavailable): logged, answered
 * with retryable SERVICE_UNAVAILABLE, and the socket stays connected.
 */
function failure(error: unknown, action: string): SubscriptionAck {
  if (error instanceof AppError && error.status < 500) {
    return {
      ok: false,
      error: { code: error.code, message: error.message, retryable: false },
    };
  }
  logRealtimeFailure(action, error);
  return { ok: false, error: serviceUnavailableError };
}

function vehicleIdsFrom(request: unknown): string[] {
  const vehicleIds =
    typeof request === "object" && request !== null
      ? (request as Record<string, unknown>).vehicleIds
      : undefined;
  return parseVehicleIdList(vehicleIds, "vehicleIds");
}

function registerHandlers(
  socket: AppSocket,
  getEm: () => EntityManager,
  limits: SocketLimits,
): void {
  // Per socket: checked before any validation or database access.
  const requests = new FixedWindowCounter(
    limits.subscriptionsPerMinute,
    subscriptionWindowMs,
  );

  socket.on(SocketEvents.subscribe, async (request, ack) => {
    if (typeof ack !== "function") return;
    if (!requests.hit("subscriptions")) {
      ack(tooManyRequests);
      return;
    }
    try {
      // Re-check the session: the admin may have been deactivated or logged out
      // since the handshake.
      const token = handshakeToken(socket);
      const admin = token
        ? await authenticateAccessToken(getEm, token)
        : undefined;
      if (!admin) {
        ack({ ok: false, error: unauthorizedError });
        endSession(socket, "unauthorized");
        return;
      }

      const requested = vehicleIdsFrom(request);
      const existing = await getEm().find(
        Vehicle,
        { id: { $in: requested } },
        { fields: ["id"] },
      );
      const known = new Set(existing.map((vehicle) => vehicle.id));

      // Cap check and join run with no await in between, so concurrent subscribe
      // requests on one socket cannot together exceed the cap. Only existing vehicles
      // that are not already followed count.
      const current = new Set(subscribedVehicles(socket));
      const toJoin = requested.filter(
        (id) => known.has(id) && !current.has(id),
      );
      if (current.size + toJoin.length > maxVehicleIdsPerRequest) {
        throw new AppError(
          400,
          "TOO_MANY_SUBSCRIPTIONS",
          `A connection can follow at most ${maxVehicleIdsPerRequest} vehicles`,
        );
      }
      await socket.join(toJoin.map(vehicleRoom));
      ack({
        ok: true,
        subscribed: subscribedVehicles(socket),
        unknown: requested.filter((id) => !known.has(id)),
      });
    } catch (error) {
      ack(failure(error, "vehicles:subscribe"));
    }
  });

  socket.on(SocketEvents.unsubscribe, async (request, ack) => {
    if (typeof ack !== "function") return;
    if (!requests.hit("subscriptions")) {
      ack(tooManyRequests);
      return;
    }
    try {
      for (const id of vehicleIdsFrom(request)) {
        await socket.leave(vehicleRoom(id));
      }
      ack({ ok: true, subscribed: subscribedVehicles(socket), unknown: [] });
    } catch (error) {
      ack(failure(error, "vehicles:unsubscribe"));
    }
  });
}

/**
 * Attaches Socket.IO to the HTTP server that also serves the Express app (same port,
 * path /socket.io). Only authenticated admins can connect, and a socket receives
 * vehicle:location only for vehicles it subscribed to.
 */
export function createSocketServer(
  httpServer: HttpServer,
  getEm: () => EntityManager,
  limits: SocketLimits = {
    connectionsPerMinute: env.socketConnectionsPerMinute,
    maxConnectionsPerIp: env.socketMaxConnectionsPerIp,
    subscriptionsPerMinute: env.socketSubscriptionsPerMinute,
  },
): { io: AppSocketServer; realtime: RealtimePublisher } {
  const guard = createConnectionGuard(limits);
  const io: AppSocketServer = new Server(httpServer, {
    cors: { origin: env.frontendOrigins },
    serveClient: false,
    // Per-IP attempt rate and open-connection cap, before any session or DB work.
    allowRequest: guard.allowRequest,
    // Largest valid message is a 500-UUID subscription (~20 KB); default is 1 MB.
    maxHttpBufferSize: 64 * 1024,
    // Drop connections that never complete the Socket.IO handshake (default 45 s).
    connectTimeout: 10_000,
  });
  io.engine.on("connection", (connection) => guard.track(connection));

  // Token checks run before any database access; see authenticateAccessToken().
  io.use(createSocketAuth(getEm));
  io.on("connection", (socket) => {
    enforceTokenLifetime(socket);
    registerHandlers(socket, getEm, limits);
  });

  return { io, realtime: createRealtimeService(io) };
}
