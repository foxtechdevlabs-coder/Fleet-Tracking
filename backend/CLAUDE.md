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
- `src/config/env.ts` is the only place environment variables are read (dotenv plus validation). `PORT` and `DATABASE_URL` are required and startup fails clearly without them. Don't add a second env loader.
- `src/config/database.ts` holds runtime database settings only (URL, debug). It opens no connections.
- `src/database/mikro-orm.config.ts` holds the MikroORM config (default export, also usable by a future MikroORM CLI). Register entities in its `entities` array; `warnWhenNoEntities: false` exists only because there are none yet. MikroORM 7 core has no `@Entity` decorators (use `defineEntity` or the separate decorators package), and `tsx`/SWC don't emit decorator metadata. Decide the entity style before adding the first entity.
- MikroORM also reads `MIKRO_ORM_*` environment variables, but values in the config file take precedence.

### App and routing
`src/app.ts` builds the Express app (`createApp()`), which needs neither the database nor environment variables and is therefore safe to import in tests. It serves Swagger UI at `/api-docs` and the raw spec at `/api-docs.json`, then mounts `src/routes/index.ts`, which mounts module routers (e.g. `/health`).

### Swagger/OpenAPI
`src/config/swagger.ts` builds the spec with swagger-jsdoc by scanning `src/modules/**/*.routes.{ts,js}` (resolved from `import.meta.url`, so it also works from `dist/`) for `@openapi` JSDoc blocks. Document new endpoints with an `@openapi` block above the route in the module's `*.routes.ts`. Document only endpoints that actually exist.

### Modules and placeholders
Each domain lives in `src/modules/<name>/` with `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.entity.ts`, `*.schema.ts` and `*.types.ts`. `src/integrations/gps` is the vendor- and protocol-agnostic GPS boundary; don't assume a GPS vendor or protocol.

**Most files are still one-line comment placeholders** describing their future purpose. Only these are implemented: `server.ts`, `app.ts`, `config/*`, `database/mikro-orm.config.ts`, `routes/index.ts` and `modules/health/*`. Implement a module only when asked, and keep the one-line purpose comment at the top of each file.

Planned data flow (from `backend/README.md`): GPS Device / Simulator → GPS Adapter → Ingestion → Validation / Normalization → Vehicle + Device Resolution → Location Processing → PostgreSQL (MikroORM) → Latest Location → Socket.IO → Frontend. The planned stack also includes Socket.IO and Zod, which are not installed yet.

### Tests
The folders are `tests/unit`, `tests/integration` and `tests/e2e`. Tests must not require PostgreSQL unless they are explicitly database integration tests. HTTP tests use Supertest against `createApp()` (`import request from "supertest"`), which needs no database and no `listen`.
