// Socket.IO connection authentication.
import type { EntityManager } from "@mikro-orm/postgresql";
import type { ExtendedError, Socket } from "socket.io";
import type { AuthenticatedAdmin } from "../../common/types/auth.types.js";
import { authenticateAccessToken } from "../auth/auth.service.js";
import {
  type ClientToServerEvents,
  type ConnectErrorData,
  type ServerToClientEvents,
  type SocketData,
  type SocketErrorInfo,
  SocketEvents,
  serviceUnavailableError,
  tokenRoom,
  unauthorizedError,
} from "./socket.events.js";

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** The access token from `io(url, { auth: { token } })` ("Bearer " prefix optional). */
export function handshakeToken(socket: AppSocket): string | undefined {
  const token: unknown = socket.handshake.auth?.token;
  if (typeof token !== "string") return undefined;
  const value = token.replace(/^Bearer\s+/i, "").trim();
  return value && !/\s/.test(value) ? value : undefined;
}

/** A `connect_error` whose message is the code and whose `data` says if retrying helps. */
function connectError(info: SocketErrorInfo): ExtendedError {
  const { message: _message, ...data } = info;
  const error = new Error(info.code) as ExtendedError;
  error.data = data satisfies ConnectErrorData;
  return error;
}

/**
 * Logs a server-side failure without the error object itself, which could carry query
 * parameters; never logs tokens or admin data.
 */
export function logRealtimeFailure(action: string, error: unknown): void {
  console.error(
    `Realtime ${action} failed:`,
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "unknown error",
  );
}

/**
 * Handshake middleware: the same checks as the HTTP requireAdmin middleware (signature,
 * expiry, active admin, not revoked). Tokens are read only from the handshake `auth`
 * payload, never from the URL, so they don't end up in proxy or access logs.
 *
 * Rejected clients receive `connect_error`:
 * - "UNAUTHORIZED" (data.retryable false): missing/invalid/expired/revoked token or
 *   inactive admin. The client should send the admin to login.
 * - "SERVICE_UNAVAILABLE" (data.retryable true): the check could not run, e.g. the
 *   database is down. The token was not judged invalid; the client should keep the
 *   session and connect again after data.retryAfterMs.
 * The client is never let in when the check could not complete.
 */
export function createSocketAuth(getEm: () => EntityManager) {
  return async (
    socket: AppSocket,
    next: (error?: ExtendedError) => void,
  ): Promise<void> => {
    let admin: AuthenticatedAdmin | undefined;
    try {
      const token = handshakeToken(socket);
      admin = token ? await authenticateAccessToken(getEm, token) : undefined;
    } catch (error) {
      logRealtimeFailure("handshake authentication", error);
      next(connectError(serviceUnavailableError));
      return;
    }

    if (!admin) {
      next(connectError(unauthorizedError));
      return;
    }
    socket.data.admin = admin;
    next();
  };
}

// setTimeout stores delays as a signed 32-bit integer; longer delays fire immediately.
const maxTimerDelayMs = 2_147_483_647;

/**
 * Joins the socket to its token's room (so logout can close it) and closes it when
 * the access token expires, sending session:ended first.
 */
export function enforceTokenLifetime(socket: AppSocket): void {
  const { tokenId, expiresAt } = socket.data.admin;
  void socket.join(tokenRoom(tokenId));

  const endAt = expiresAt.getTime();
  const schedule = (): NodeJS.Timeout =>
    setTimeout(
      () => {
        if (Date.now() < endAt) {
          timer = schedule();
          return;
        }
        endSession(socket, "token_expired");
      },
      Math.min(Math.max(endAt - Date.now(), 0), maxTimerDelayMs),
    );
  let timer = schedule();
  socket.on("disconnect", () => clearTimeout(timer));
}

export function endSession(
  socket: AppSocket,
  reason: "token_expired" | "logged_out" | "unauthorized",
): void {
  socket.emit(SocketEvents.sessionEnded, { reason });
  socket.disconnect(true);
}
