// Real-time broadcast service.
import type { Request } from "express";
import type { Server } from "socket.io";
import type { LocationHistory } from "../tracking/location.entity.js";
import { endSession, logRealtimeFailure } from "./socket.auth.js";
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
  SocketEvents,
  tokenRoom,
  type VehicleLocationPayload,
  vehicleRoom,
} from "./socket.events.js";

export type AppSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** What the HTTP layer may do with realtime clients; tests can provide a fake. */
export interface RealtimePublisher {
  /** Sends vehicle:location to sockets subscribed to that vehicle only. */
  publishVehicleLocation(payload: VehicleLocationPayload): void;
  /** Closes every socket opened with this access token (e.g. after logout). */
  disconnectToken(tokenId: string): void;
}

export function createRealtimeService(io: AppSocketServer): RealtimePublisher {
  return {
    publishVehicleLocation(payload) {
      io.to(vehicleRoom(payload.vehicleId)).emit(
        SocketEvents.vehicleLocation,
        payload,
      );
    },
    disconnectToken(tokenId) {
      for (const socket of io.of("/").sockets.values()) {
        if (socket.rooms.has(tokenRoom(tokenId))) {
          endSession(socket, "logged_out");
        }
      }
    },
  };
}

export function toVehicleLocationPayload(
  location: LocationHistory,
): VehicleLocationPayload {
  return {
    locationId: location.id,
    vehicleId: location.vehicleId,
    deviceId: location.deviceId,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed ?? null,
    heading: location.heading ?? null,
    altitude: location.altitude ?? null,
    recordedAt: location.recordedAt.toISOString(),
    ingestedAt: location.ingestedAt.toISOString(),
  };
}

/** The publisher attached by server.ts (absent in tests that don't need realtime). */
export function getRealtime(req: Request): RealtimePublisher | undefined {
  return req.app.locals.realtime as RealtimePublisher | undefined;
}

/**
 * Runs a realtime side effect without ever failing the HTTP request: the data is
 * already committed, so a broadcast problem must not turn into an error response.
 */
export function safely(action: string, effect: () => void): void {
  try {
    effect();
  } catch (error) {
    logRealtimeFailure(action, error);
  }
}
