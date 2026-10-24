// Socket.IO connection and subscription rate limits (in-memory, per process).
import type { IncomingMessage } from "node:http";
import { ipKeyGenerator } from "express-rate-limit";

/** Counts hits per key in fixed windows; expired entries are swept lazily. */
export class FixedWindowCounter {
  readonly #hits = new Map<string, { count: number; resetAt: number }>();
  #nextSweep = 0;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** Records a hit; returns false when the key is already over its limit. */
  hit(key: string, now = Date.now()): boolean {
    if (now >= this.#nextSweep) {
      for (const [entryKey, entry] of this.#hits) {
        if (entry.resetAt <= now) this.#hits.delete(entryKey);
      }
      this.#nextSweep = now + this.windowMs;
    }

    const entry = this.#hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.#hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
}

/**
 * Client IP of a Socket.IO HTTP request, grouped like the Express limiters (IPv6 by /56).
 * Uses the TCP peer address: like Express without `trust proxy`, X-Forwarded-For is
 * ignored, so behind a reverse proxy all clients share the proxy's limits.
 */
export function socketClientIp(req: IncomingMessage): string {
  return ipKeyGenerator(req.socket.remoteAddress ?? "unknown");
}

export interface SocketLimits {
  /** New connection attempts per IP per minute (counted before authentication). */
  connectionsPerMinute: number;
  /** Open connections per IP at the same time. */
  maxConnectionsPerIp: number;
  /** vehicles:subscribe + vehicles:unsubscribe requests per socket per minute. */
  subscriptionsPerMinute: number;
}

/**
 * Guards new engine sessions per IP: a rate of attempts and a cap on open connections.
 * `allowRequest` runs for each new session before Socket.IO creates any state or the
 * auth middleware touches the database; refused clients get HTTP 403 (`connect_error`).
 */
export function createConnectionGuard(limits: SocketLimits) {
  const attempts = new FixedWindowCounter(limits.connectionsPerMinute, 60_000);
  const open = new Map<string, number>();

  return {
    allowRequest(
      req: IncomingMessage,
      callback: (error: string | null, success: boolean) => void,
    ): void {
      const ip = socketClientIp(req);
      if (!attempts.hit(ip)) {
        callback("TOO_MANY_CONNECTION_ATTEMPTS", false);
        return;
      }
      if ((open.get(ip) ?? 0) >= limits.maxConnectionsPerIp) {
        callback("TOO_MANY_CONNECTIONS", false);
        return;
      }
      callback(null, true);
    },

    /** Call for every established engine connection; releases the slot on close. */
    track(connection: {
      request: IncomingMessage;
      once(event: "close", listener: () => void): unknown;
    }): void {
      const ip = socketClientIp(connection.request);
      open.set(ip, (open.get(ip) ?? 0) + 1);
      connection.once("close", () => {
        const remaining = (open.get(ip) ?? 1) - 1;
        if (remaining > 0) open.set(ip, remaining);
        else open.delete(ip);
      });
    },
  };
}
