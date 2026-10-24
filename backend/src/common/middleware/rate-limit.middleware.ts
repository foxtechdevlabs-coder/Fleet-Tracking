// Rate limiting middleware.
import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../errors/app-error.js";

const loginWindowMs = 15 * 60 * 1000;

// Counted per client IP (IPv6 grouped by /56 subnet). Only failed attempts count, so
// legitimate logins never consume the allowance. Rejected requests stop here, before
// the scrypt verification runs, which also caps the CPU an attacker can consume.
const maxFailedLoginsPerIp = 10;

// Counted per target account, across all IPs, to slow distributed guessing against one
// admin. Kept higher than the per-IP limit so an attacker cannot easily lock a real
// admin out by deliberately failing logins for their email.
const maxFailedLoginsPerAccount = 20;

// The 429 goes through the global error handler, so it uses the normal error format.
function tooManyRequests(code: string, message: string): RequestHandler {
  return (_req, _res, next) => {
    next(new AppError(429, code, message));
  };
}

function clientIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? "unknown");
}

function loginEmail(req: Request): string {
  const email: unknown = (req.body as Record<string, unknown> | undefined)
    ?.email;
  // Same normalization as parseLoginInput(), so "Admin@x.com " and "admin@x.com" share a counter.
  return typeof email === "string" && email.trim()
    ? `email:${email.trim().toLowerCase()}`
    : `ip:${clientIp(req)}`;
}

// Counters live in process memory: they reset on restart and are not shared between
// instances, so running several API instances needs a shared store (e.g. Redis).
// A factory so tests can build independent instances.
export function createLoginRateLimit(): RequestHandler[] {
  const common = {
    windowMs: loginWindowMs,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooManyRequests(
      "TOO_MANY_LOGIN_ATTEMPTS",
      "Too many failed login attempts. Try again later.",
    ),
  } as const;

  return [
    rateLimit({
      ...common,
      identifier: "login-ip",
      limit: maxFailedLoginsPerIp,
      keyGenerator: clientIp,
    }),
    rateLimit({
      ...common,
      identifier: "login-account",
      limit: maxFailedLoginsPerAccount,
      keyGenerator: loginEmail,
    }),
  ];
}

// Fixed one-minute windows per client IP, counting every request (successful or not).
// Applied in app.ts before body parsing, authentication and any database access, so a
// flood is rejected cheaply. Same in-memory caveats as the login limiter.
export function createRequestRateLimit(options: {
  identifier: string;
  limitPerMinute: number;
  skip?: (req: Request) => boolean;
}): RequestHandler {
  return rateLimit({
    identifier: options.identifier,
    windowMs: 60 * 1000,
    limit: options.limitPerMinute,
    keyGenerator: clientIp,
    skip: options.skip,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooManyRequests(
      "TOO_MANY_REQUESTS",
      "Too many requests. Try again later.",
    ),
  });
}
