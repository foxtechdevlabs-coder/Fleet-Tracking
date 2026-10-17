// Socket.IO event name definitions.
import type { AuthenticatedAdmin } from "../../common/types/auth.types.js";

export const SocketEvents = {
  /** client → server: start receiving vehicle:location for these vehicles. */
  subscribe: "vehicles:subscribe",
  /** client → server: stop receiving vehicle:location for these vehicles. */
  unsubscribe: "vehicles:unsubscribe",
  /** server → client: a vehicle's live position changed. */
  vehicleLocation: "vehicle:location",
  /** server → client: the access token expired or was revoked; the socket is closed next. */
  sessionEnded: "session:ended",
} as const;

/**
 * Sent only after the GPS reading was committed and became the vehicle's live
 * position (not for duplicates or older, out-of-order readings).
 */
export interface VehicleLocationPayload {
  /** LocationHistory row ID; lets clients ignore an event they already applied. */
  locationId: string;
  vehicleId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  /** Device timestamp (ISO 8601). Clients should ignore events older than what they show. */
  recordedAt: string;
  /** Server receive time (ISO 8601). */
  ingestedAt: string;
}

export interface SubscriptionRequest {
  vehicleIds: string[];
}

/**
 * Every error a client can receive says whether retrying can help:
 * - retryable: false — the request or session is invalid (e.g. UNAUTHORIZED: log in again).
 * - retryable: true — a temporary server-side problem (e.g. SERVICE_UNAVAILABLE): keep
 *   the session and retry after `retryAfterMs`. Never log the admin out for these.
 */
export interface SocketErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
  /** Suggested minimum wait before retrying (retryable errors only). */
  retryAfterMs?: number;
}

/** Suggested wait before retrying after SERVICE_UNAVAILABLE. */
export const serviceUnavailableRetryAfterMs = 2000;

export const unauthorizedError: SocketErrorInfo = {
  code: "UNAUTHORIZED",
  message: "Unauthorized",
  retryable: false,
};

export const serviceUnavailableError: SocketErrorInfo = {
  code: "SERVICE_UNAVAILABLE",
  message: "Service temporarily unavailable. Retry shortly.",
  retryable: true,
  retryAfterMs: serviceUnavailableRetryAfterMs,
};

/**
 * `err.data` of a `connect_error` raised by the authentication middleware; `err.message`
 * equals `code` ("UNAUTHORIZED" or "SERVICE_UNAVAILABLE"). socket.io-client does not
 * reconnect by itself after this kind of error: on `retryable: true` the client must call
 * `socket.connect()` again after `retryAfterMs` (with backoff).
 */
export type ConnectErrorData = Omit<SocketErrorInfo, "message">;

export type SubscriptionAck =
  | {
      ok: true;
      /** Vehicles this socket now receives updates for (after this request). */
      subscribed: string[];
      /** Requested IDs that are valid UUIDs but no such vehicle exists. */
      unknown: string[];
    }
  | { ok: false; error: SocketErrorInfo };

export interface SessionEndedPayload {
  reason: "token_expired" | "logged_out" | "unauthorized";
}

export interface ClientToServerEvents {
  "vehicles:subscribe": (
    request: SubscriptionRequest,
    ack: (result: SubscriptionAck) => void,
  ) => void;
  "vehicles:unsubscribe": (
    request: SubscriptionRequest,
    ack: (result: SubscriptionAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "vehicle:location": (payload: VehicleLocationPayload) => void;
  "session:ended": (payload: SessionEndedPayload) => void;
}

export interface SocketData {
  admin: AuthenticatedAdmin;
}

/** Room that receives one vehicle's vehicle:location events. */
export function vehicleRoom(vehicleId: string): string {
  return `vehicle:${vehicleId}`;
}

/** Room holding every socket opened with one access token (its JWT ID). */
export function tokenRoom(tokenId: string): string {
  return `token:${tokenId}`;
}
