# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The existing repository code is the implementation source of truth. CLAUDE.md describes project rules and constraints, but must not override actual code, migrations, or explicitly approved requirements. Where this file describes the current state (e.g. which modules are placeholders), inspect the code rather than relying on it.

## Repository layout

- `backend/`: Vehicle Tracking System Phase 1 API (Node.js, Express 5, TypeScript, PostgreSQL, MikroORM 7). All commands below run from `backend/`.
- `Frontend/`: developed separately. Never modify anything in `Frontend/`.

The user reviews and commits changes manually. Do not stage, commit or push unless explicitly asked.

## Commands (backend, pnpm only; never npm, yarn or bun)

```bash
pnpm install
pnpm run dev             # build, then tsc --watch (rebuild + type-check), biome check --watch and node --watch dist/server.js, via concurrently (needs .env)
pnpm run check           # biome check . && tsc --noEmit (run before committing)
pnpm run build           # clean dist/, then tsc -> dist/
pnpm start               # node dist/server.js (production; run build first)
pnpm run typecheck       # tsc --noEmit
pnpm run migration:create # MikroORM CLI: generate a migration from entity changes (diffed against the snapshot)
pnpm run migration:up     # MikroORM CLI: apply pending migrations
pnpm run admin:create    # create the first admin (src/database/seeds/create-admin.ts)
pnpm run lint            # biome check .  (Biome only; no ESLint or Prettier)
pnpm run format          # biome format --write .
pnpm test                # Jest (ESM mode)
pnpm test:watch
pnpm test:coverage       # writes coverage/ (gitignored and excluded from Biome)
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm run test:integration   # PostgreSQL tests (local server only)

pnpm test tests/unit/setup.test.ts   # single file
pnpm test -t "runs TypeScript"       # single test by name
```

pnpm 11 passes a literal `--` through to Jest, so pass Jest flags directly (`pnpm test --coverage=false`, not `pnpm test -- ...`).

pnpm 11 blocks dependency install scripts until they are approved. Each approval lives under `allowBuilds` in `backend/pnpm-workspace.yaml`, which exists for this reason even though this is a single package. When a new dependency adds a placeholder entry there, set it to `true` or `false` explicitly.

## Toolchain constraints

- **TypeScript 7 (native compiler).** ts-jest and ts-node are incompatible with the current TypeScript 7 setup because they depend on the TypeScript compiler API, which the `typescript` package no longer ships. Therefore Jest uses `@swc/jest`, and the config is `jest.config.js` (Jest loads a `.ts` config through ts-node). SWC doesn't type-check, and `tsconfig.json` only includes `src/`, so `pnpm test` won't catch type errors in tests.
- **ESM + NodeNext.** `"type": "module"`. Relative imports must use `.js` extensions pointing at `.ts` sources (`import { env } from "./config/env.js"`). Jest maps `.js` back to `.ts` via `moduleNameMapper`, and runs through `node --experimental-vm-modules` (the resulting ExperimentalWarning is expected). In tests, import `describe/it/expect/jest` from `@jest/globals`.
- **Node >= 22.17.0.** This is required by MikroORM 7.
- **Biome 2.x.** It formats with double quotes and 2-space indentation. It does not read `.gitignore`; exclusions live in `biome.json` `files.includes`.

## Architecture

### Startup lifecycle (`src/server.ts`)
`env` is validated on import. Then `MikroORM.init`, then `orm.connect()`, then **`orm.checkConnection()`**, then `createApp()`, then `http.createServer(app)` with Socket.IO attached (`createSocketServer()`, sets `app.locals.realtime`), then `httpServer.listen`. Any failure exits with code 1. Shutdown calls `io.close()`, which disconnects sockets and closes the HTTP server, then closes the ORM.
- MikroORM 7's `connect()` only creates the pool and sends no query, so `checkConnection()` (which runs `select 1`) is the real reachability check. Don't remove it.
- `ensureDatabase: false` is deliberate: MikroORM's default silently runs `CREATE DATABASE` when the database is missing. Keep it off.
- `http.Server.listen` reports errors (e.g. `EADDRINUSE`) as an `error` event; `server.ts` wraps `listen` in a Promise that rejects on it.

### Configuration split
- `src/config/env.ts` is the only place environment variables are read (dotenv plus a **Zod** schema). Don't add a second env loader. On import it validates everything and throws one `Invalid environment configuration` error listing **all** problems. Blank values count as unset. Rules involving two variables live in `crossFieldProblems()`, which runs on the raw values so they are reported even when another field fails (a Zod object refinement would be skipped). It exports the plain `env` object (`nodeEnv`, `port`, `frontendOrigins`, `databaseUrl`, `databaseSsl`, `databaseSslCa`, `jwtSecret`, `adminInitialEmail`, `adminInitialPassword`, `adminInitialName`) and `isDevelopment`; keep that shape, consumers depend on it. Rules:
  - `PORT` required (1-65535). `NODE_ENV` defaults to `production` when unset (safe default). Only `development` turns on MikroORM query logging (`database.ts`), and only the `query`/`info` namespaces: SQL is logged with `?` placeholders. Never use `debug: true` or the `query-params` namespace; they inline parameter values (emails, password hashes) into the logs.
  - `JWT_SECRET` required, at least 32 bytes. There is no fallback secret; never add one.
  - `FRONTEND_ORIGINS`: comma-separated exact HTTP(S) origins, default `http://localhost:5173`.
  - `DATABASE_URL`, or all of `DB_USERNAME`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_NAME`. `sslmode` in the URL is rejected because MikroORM ignores URL query parameters.
  - `DATABASE_SSL`: `disable` | `require` (default; encrypted, certificate not verified) | `verify-full`. `DATABASE_SSL_CA` is only allowed with `verify-full`. In production (including an unset `NODE_ENV`) `DATABASE_SSL` must be `verify-full`; `crossFieldProblems()` must use the same `NODE_ENV` default as the schema.
  - `GPS_MAX_CLOCK_SKEW_SECONDS` (default 300, 0-86400): ingest rejects `recordedAt` further ahead of the server clock (`parseRecordedAt()` in `tracking.schema.ts`, ingest only; report filters use `parseTrackingTimestamp()` and allow future dates). Older readings are never rejected.
  - `SOCKET_CONNECTIONS_PER_MINUTE` (30), `SOCKET_MAX_CONNECTIONS_PER_IP` (20), `SOCKET_SUBSCRIPTIONS_PER_MINUTE` (30): Socket.IO abuse limits, see Realtime.
  - `API_RATE_LIMIT_PER_MINUTE` (default 300) and `INGEST_RATE_LIMIT_PER_MINUTE` (default 1200): per-IP request limits, see Authentication.
  - `ADMIN_INITIAL_EMAIL` / `ADMIN_INITIAL_PASSWORD` (12-128 chars) are optional but must be set together; they have no defaults. Only `database/seeds/admin.seed.ts` (`seedAdmin()`) uses them.
- `src/config/database.ts` holds runtime database settings (URL, debug, TLS options). It opens no connections. TLS reaches `pg` through `driverOptions: { ssl }` in the MikroORM config; that is the only working way to configure it. A relative `DATABASE_SSL_CA` is resolved against `backend/` (via `import.meta.url`), so it works from `src/` and `dist/` regardless of the working directory; the file must be a PEM certificate.
- **Database is Supabase** (connection pooler, `*.pooler.supabase.com`). Use `DATABASE_SSL=verify-full` with `DATABASE_SSL_CA=./certs/prod-ca-2021.crt` (Supabase Root 2021 CA, public, committed, expires 2031-04-26). Ship `certs/` alongside `dist/` when deploying.
- **Migrations** use `@mikro-orm/migrations` via `@mikro-orm/cli` (found through `mikro-orm.configPaths` in `package.json`, TS loaded with `tsx`). Files live in `src/database/migrations` (excluded from Biome because they are generated). The database is Supabase-hosted, so `schemaGenerator.ignoreSchema` lists Supabase's schemas; never remove it, or schema diffs will try to drop them. `snapshotOnMigrate: false` is deliberate: entities don't declare the FKs/CHECKs the initial SQL created, so the snapshot must come from entities, not the live DB.
- `src/database/mikro-orm.config.ts` holds the MikroORM config (default export, also used by the MikroORM CLI). Register entities in its `entities` array. Entities use **`EntitySchema`** (a class plus a `<Name>Schema` export in `*.entity.ts`); MikroORM 7 core has no `@Entity` decorators and `tsx`/SWC don't emit decorator metadata, so don't introduce decorators. Relations are plain UUID columns (`vehicleId`, `deviceId`); the FKs exist only in the database (initial migration), so review generated migrations for FK changes by hand.
- MikroORM also reads `MIKRO_ORM_*` environment variables, but values in the config file take precedence.

### App and routing
`src/app.ts` builds the Express app (`createApp(orm?, rateLimits?, realtime?)`: `rateLimits` defaults to the env limits (tests pass small values), `realtime` is the optional publisher, which `server.ts` instead sets on `app.locals.realtime`). It opens no connections, but importing it **does require valid env vars** (`cors.ts` imports `env`); tests get them from `tests/unit/test-env.cjs` (Jest `setupFiles`). Request handlers get a forked EntityManager via `getEntityManager(req)` (`common/middleware/entity-manager.ts`) from `app.locals.orm`. The app serves Swagger UI at `/api-docs` and the raw spec at `/api-docs.json`, then mounts `src/routes/index.ts`.

Routes: `/health` and `/api/v1/health`, `/api/v1/auth` (login, logout, me), vehicles and devices at both `/api/v1/...` and `/api/...` (the `/api/...` paths are the documented ones), `/api/v1/setup/vehicle-device` (atomic vehicle + device creation), `/api/v1/tracking` (`POST /ingest`, `GET /latest`, `POST /latest` for up to 500 IDs; the GET query string fails with 431 above ~430 UUIDs) and `/api/v1/reports/locations`. Responses use `{ success, message?, data }` and errors `{ success: false, message, code }` via `AppError` and `common/errors/error-handler.ts`.

### Authentication
Admin-only. `modules/auth/auth.service.ts` implements scrypt password hashing (`scrypt$salt$hash`) and HS256 JWTs signed with `env.jwtSecret` (1 hour lifetime). `requireAdmin` (`common/middleware/auth.middleware.ts`) checks the bearer token, the admin's `isActive`, and the `revoked_tokens` table (logout). Missing/invalid tokens return 401 with code `UNAUTHORIZED`. `POST /login` is rate limited by `createLoginRateLimit()` (`common/middleware/rate-limit.middleware.ts`, `express-rate-limit`): failed attempts only, 10 per IP and 20 per account (normalized email) per 15 minutes, then 429 `TOO_MANY_LOGIN_ATTEMPTS` with `Retry-After`, before any DB lookup or scrypt. Every `/api/*` request is also limited per IP by `createRequestRateLimit()`, mounted in `app.ts` after CORS and before body parsing/auth: `env.apiRateLimitPerMinute` (default 300/min), with `/api/v1/tracking/ingest` on its own `env.ingestRateLimitPerMinute` (default 1200/min); health checks are never limited. Over the limit: 429 `TOO_MANY_REQUESTS`. These limiters are created inside `createApp()`, so each app instance (and each test) has its own counters. Counters are in process memory (reset on restart, not shared across instances). Limits are per `req.ip`, so behind a reverse proxy Express's `trust proxy` must be configured or all clients share one counter. Create the first admin with `pnpm run admin:create` (reads `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `ADMIN_ROLE` directly).

Known pitfall: `common/utils/password.util.ts` (used by `admins/admin.repository.ts` `createAdmin()` and therefore `database/seeds/admin.seed.ts`) writes `salt_hex:key_hex` hashes, which the login's `verifyPassword` rejects. Use the `auth.service.ts` helpers for anything that must be able to log in.

### Swagger/OpenAPI
`src/config/swagger.ts` builds the spec with swagger-jsdoc by scanning `src/modules/**/*.routes.{ts,js}` (resolved from `import.meta.url`, so it also works from `dist/`) for `@openapi` JSDoc blocks. Document new endpoints with an `@openapi` block above the route in the module's `*.routes.ts`. Document only endpoints that actually exist.

### Modules and placeholders
Each domain lives in `src/modules/<name>/` with `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.entity.ts`, `*.schema.ts` and `*.types.ts`. `src/integrations/gps` is the vendor- and protocol-agnostic GPS boundary; don't assume a GPS vendor or protocol.

Implemented: `health`, `auth`, `vehicles`, `devices` (including `device-vehicle.service.ts`), `setup`, `tracking` (ingest, latest positions), `reports` (locations) and `realtime`; `admins` is partial; `settings`, `telemetry` and `trips` are mostly one-line comment placeholders (except their entities), as are `tracking/location.processor.ts` and `src/integrations/gps/*`. Check the actual file before assuming either way. Implement a module only when asked, and keep the one-line purpose comment at the top of each file.

When resolving merge conflicts in repositories/services, don't just take one side: check every caller (`grep` the function names) and keep each function something still uses. A one-sided resolution has already removed functions in use (`existsByPlateNumber`, `existsByIdentifier`).

Planned data flow (from `backend/README.md`): GPS Device / Simulator → GPS Adapter → Ingestion → Validation / Normalization → Vehicle + Device Resolution → Location Processing → PostgreSQL (MikroORM) → Latest Location → Socket.IO → Frontend. Zod is installed (used for env validation) and Socket.IO is implemented (see Realtime).

### Realtime (Socket.IO)
`src/modules/realtime/`: `socket.events.ts` (event names, payload types, room names), `socket.auth.ts` (handshake auth via `authenticateAccessToken()` from `auth.service.ts`, the same check `requireAdmin` uses; token only from `handshake.auth.token`; disconnect at token expiry), `socket.server.ts` (`createSocketServer()`: CORS from `env.frontendOrigins`, `vehicles:subscribe`/`vehicles:unsubscribe` with ack, max 500 vehicles per socket (only existing, not-yet-followed vehicles count; cap check and join run with no await in between so concurrent subscribes cannot exceed it), session re-checked on subscribe), `realtime.service.ts` (`RealtimePublisher`, `toVehicleLocationPayload()`, `getRealtime(req)`, `safely()`).
- HTTP code reaches sockets only through `getRealtime(req)` (`app.locals.realtime`, absent in most tests). Wrap realtime side effects in `safely()` so they never fail an already-committed request.
- `vehicle:location` goes to room `vehicle:<id>` only, never `io.emit`. The tracking controller publishes after `ingestLocation()` returns (committed) and only when `!duplicate && latestUpdated`. Logout calls `disconnectToken(jti)` (sockets join `token:<jti>`).
- `upsertLatestLocation()` must use `em.execute()` (joins the transaction) and returns whether the live position advanced (`RETURNING`). Never use `em.getConnection().execute()` inside `em.transactional()`: it runs on a separate connection and commits on its own.
- Clients catch up after reconnecting via `GET /api/v1/tracking/latest`. Rooms are in-memory (single instance); more instances need a shared adapter (e.g. Redis).
- Errors carry `retryable` (`SocketErrorInfo` in `socket.events.ts`). The handshake middleware must distinguish `UNAUTHORIZED` (token/admin invalid, `retryable: false`) from `SERVICE_UNAVAILABLE` (the check threw, e.g. DB down, `retryable: true`, `retryAfterMs`); never report a failed check as `UNAUTHORIZED`, and never let a client in when the check failed. Unexpected subscribe failures ack `SERVICE_UNAVAILABLE` and keep the socket. Log failures with `logRealtimeFailure()` (name + message only, no tokens or error objects). socket.io-client does not auto-reconnect after a middleware `connect_error`, so the frontend must call `socket.connect()` for retryable errors (recipe in `docs/api/api-contract.md`).
- Abuse limits (`socket.rate-limit.ts`, separate from the Express limiters, which don't see `/socket.io`): `allowRequest` enforces per-IP connection attempts/min and open connections (`SOCKET_CONNECTIONS_PER_MINUTE`, `SOCKET_MAX_CONNECTIONS_PER_IP`) before any session or DB work; each socket has `SOCKET_SUBSCRIPTIONS_PER_MINUTE`, checked before the session re-check and vehicle lookup. Also `maxHttpBufferSize` 64 KB and `connectTimeout` 10 s. IPs are the TCP peer address (X-Forwarded-For ignored, same caveat as `trust proxy`). `createSocketServer()` takes optional `limits` (tests pass small values). Invalid/forged/expired tokens never reach the DB: keep `verifyAccessToken()` before `getEm()` in `authenticateAccessToken()`.
- Tests: `tests/unit/realtime.test.ts` runs a real HTTP + Socket.IO server on port 0 with `socket.io-client` (dev dependency) and an in-memory EntityManager.

### Tests
The folders are `tests/unit`, `tests/integration` and `tests/e2e`. Tests must not require PostgreSQL unless they are explicitly database integration tests. HTTP tests use Supertest against `createApp()` (`import request from "supertest"`), which needs no database and no `listen`. Routes that touch the database are tested by passing a fake ORM, `createApp({ em: { fork: () => em } } as never)`, with an in-memory `em` (see `tests/unit/device-vehicle-api.test.ts`; its `flush()` enforces unique plate numbers and device identifiers). `tests/unit/test-env.cjs` sets the env vars every test needs; update it when `env.ts` gains a new required variable.

PostgreSQL integration tests live in `tests/integration` and use `describeWithDatabase` / `createTestDatabase()` from `tests/integration/postgres-test-database.ts`: they skip unless `TEST_DATABASE_URL` is set, refuse non-local hosts, create a fresh `fleet_it_*` database per file, apply the real migrations via `orm.migrator.up()` (register new migrations in its `migrationsList`), use `driverOptions: { ssl: false }`, and drop the database afterwards. Never point them at `DATABASE_URL` (Supabase); `test-env.cjs` keeps any pre-set `DATABASE_URL` and `env.ts` also loads `.env`, so integration code must use only `TEST_DATABASE_URL`. Use them for anything whose correctness depends on real SQL, transactions or concurrency (the upsert, unique-index duplicate handling, rollback); don't emulate SQL in JavaScript for those. Fakes: `tests/unit/realtime.test.ts`'s in-memory EM rolls back on error and has `status.down` / `status.failLatestWrite` switches.
