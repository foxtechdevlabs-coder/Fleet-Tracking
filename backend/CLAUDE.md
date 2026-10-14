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
`env` is validated on import. Then `MikroORM.init`, then `orm.connect()`, then **`orm.checkConnection()`**, then `createApp()`, then `listen`. Any failure exits with code 1.
- MikroORM 7's `connect()` only creates the pool and sends no query, so `checkConnection()` (which runs `select 1`) is the real reachability check. Don't remove it.
- `ensureDatabase: false` is deliberate: MikroORM's default silently runs `CREATE DATABASE` when the database is missing. Keep it off.
- Express 5 passes `listen` errors (e.g. `EADDRINUSE`) to the listen callback. `server.ts` wraps `listen` in a Promise that rejects on that error.

### Configuration split
- `src/config/env.ts` is the only place environment variables are read (dotenv plus a **Zod** schema). Don't add a second env loader. On import it validates everything and throws one `Invalid environment configuration` error listing **all** problems. Blank values count as unset. Rules involving two variables live in `crossFieldProblems()`, which runs on the raw values so they are reported even when another field fails (a Zod object refinement would be skipped). It exports the plain `env` object (`nodeEnv`, `port`, `frontendOrigins`, `databaseUrl`, `databaseSsl`, `databaseSslCa`, `jwtSecret`, `adminInitial*`) and `isDevelopment`; keep that shape, consumers depend on it. Rules:
  - `PORT` required (1-65535). `NODE_ENV` defaults to `development` (which also turns on MikroORM query logging via `database.ts`).
  - `JWT_SECRET` required, at least 32 bytes. There is no fallback secret; never add one.
  - `FRONTEND_ORIGINS`: comma-separated exact HTTP(S) origins, default `http://localhost:5173`.
  - `DATABASE_URL`, or all of `DB_USERNAME`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_NAME`. `sslmode` in the URL is rejected because MikroORM ignores URL query parameters.
  - `DATABASE_SSL`: `disable` | `require` (default; encrypted, certificate not verified) | `verify-full`. `DATABASE_SSL_CA` is only allowed with `verify-full`.
- `src/config/database.ts` holds runtime database settings (URL, debug, TLS options). It opens no connections. TLS reaches `pg` through `driverOptions: { ssl }` in the MikroORM config; that is the only working way to configure it. A relative `DATABASE_SSL_CA` is resolved against `backend/` (via `import.meta.url`), so it works from `src/` and `dist/` regardless of the working directory; the file must be a PEM certificate.
- **Database is Supabase** (connection pooler, `*.pooler.supabase.com`). Use `DATABASE_SSL=verify-full` with `DATABASE_SSL_CA=./certs/prod-ca-2021.crt` (Supabase Root 2021 CA, public, committed, expires 2031-04-26). Ship `certs/` alongside `dist/` when deploying.
- **Migrations** use `@mikro-orm/migrations` via `@mikro-orm/cli` (found through `mikro-orm.configPaths` in `package.json`, TS loaded with `tsx`). Files live in `src/database/migrations` (excluded from Biome because they are generated). The database is Supabase-hosted, so `schemaGenerator.ignoreSchema` lists Supabase's schemas; never remove it, or schema diffs will try to drop them. `snapshotOnMigrate: false` is deliberate: entities don't declare the FKs/CHECKs the initial SQL created, so the snapshot must come from entities, not the live DB.
- `src/database/mikro-orm.config.ts` holds the MikroORM config (default export, also used by the MikroORM CLI). Register entities in its `entities` array. Entities use **`EntitySchema`** (a class plus a `<Name>Schema` export in `*.entity.ts`); MikroORM 7 core has no `@Entity` decorators and `tsx`/SWC don't emit decorator metadata, so don't introduce decorators. Relations are plain UUID columns (`vehicleId`, `deviceId`); the FKs exist only in the database (initial migration), so review generated migrations for FK changes by hand.
- MikroORM also reads `MIKRO_ORM_*` environment variables, but values in the config file take precedence.

### App and routing
`src/app.ts` builds the Express app (`createApp(orm?)`). It opens no connections, but importing it **does require valid env vars** (`cors.ts` imports `env`); tests get them from `tests/unit/test-env.cjs` (Jest `setupFiles`). Request handlers get a forked EntityManager via `getEntityManager(req)` (`common/middleware/entity-manager.ts`) from `app.locals.orm`. The app serves Swagger UI at `/api-docs` and the raw spec at `/api-docs.json`, then mounts `src/routes/index.ts`.

Routes: `/health` and `/api/v1/health`, `/api/v1/auth` (login, logout, me), vehicles and devices at both `/api/v1/...` and `/api/...` (the `/api/...` paths are the documented ones), and `/api/v1/setup/vehicle-device` (atomic vehicle + device creation). Responses use `{ success, message?, data }` and errors `{ success: false, message, code }` via `AppError` and `common/errors/error-handler.ts`.

### Authentication
Admin-only. `modules/auth/auth.service.ts` implements scrypt password hashing (`scrypt$salt$hash`) and HS256 JWTs signed with `env.jwtSecret` (1 hour lifetime). `requireAdmin` (`common/middleware/auth.middleware.ts`) checks the bearer token, the admin's `isActive`, and the `revoked_tokens` table (logout). Missing/invalid tokens return 401 with code `UNAUTHORIZED`. Create the first admin with `pnpm run admin:create` (reads `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `ADMIN_ROLE` directly).

Known pitfall: `common/utils/password.util.ts` (used by `admins/admin.repository.ts` and the unused `database/seeds/admin.seed.ts`) writes `salt_hex:key_hex` hashes, which the login's `verifyPassword` rejects. Use the `auth.service.ts` helpers for anything that must be able to log in.

### Swagger/OpenAPI
`src/config/swagger.ts` builds the spec with swagger-jsdoc by scanning `src/modules/**/*.routes.{ts,js}` (resolved from `import.meta.url`, so it also works from `dist/`) for `@openapi` JSDoc blocks. Document new endpoints with an `@openapi` block above the route in the module's `*.routes.ts`. Document only endpoints that actually exist.

### Modules and placeholders
Each domain lives in `src/modules/<name>/` with `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.entity.ts`, `*.schema.ts` and `*.types.ts`. `src/integrations/gps` is the vendor- and protocol-agnostic GPS boundary; don't assume a GPS vendor or protocol.

Implemented: `health`, `auth`, `vehicles`, `devices` (including `device-vehicle.service.ts`) and `setup`; `tracking` and `admins` are partial; `realtime`, `reports`, `settings`, `telemetry` and `trips` are mostly one-line comment placeholders (except their entities). Check the actual file before assuming either way. Implement a module only when asked, and keep the one-line purpose comment at the top of each file.

When resolving merge conflicts in repositories/services, don't just take one side: check every caller (`grep` the function names) and keep each function something still uses. A one-sided resolution has already removed functions in use (`existsByPlateNumber`, `existsByIdentifier`).

Planned data flow (from `backend/README.md`): GPS Device / Simulator → GPS Adapter → Ingestion → Validation / Normalization → Vehicle + Device Resolution → Location Processing → PostgreSQL (MikroORM) → Latest Location → Socket.IO → Frontend. Zod is installed (used for env validation); Socket.IO is planned but not installed yet.

### Tests
The folders are `tests/unit`, `tests/integration` and `tests/e2e`. Tests must not require PostgreSQL unless they are explicitly database integration tests. HTTP tests use Supertest against `createApp()` (`import request from "supertest"`), which needs no database and no `listen`. Routes that touch the database are tested by passing a fake ORM, `createApp({ em: { fork: () => em } } as never)`, with an in-memory `em` (see `tests/unit/device-vehicle-api.test.ts`; its `flush()` enforces unique plate numbers and device identifiers). `tests/unit/test-env.cjs` sets the env vars every test needs; update it when `env.ts` gains a new required variable.
