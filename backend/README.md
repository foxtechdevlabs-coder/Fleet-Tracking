# Vehicle Tracking Backend

Vehicle Tracking System — Phase 1 backend.

Planned stack: Node.js, Express, TypeScript, PostgreSQL, MikroORM, Socket.IO, Zod.

**Status:** admin authentication and authenticated Vehicle/Device CRUD endpoints
and an atomic vehicle-plus-device setup endpoint are implemented alongside the
health endpoint. Tracking, telemetry, trip, report, settings, and real-time/GPS
routes remain planned.

## Local development

Requirements: Node.js `>=22.17.0` and pnpm. From this directory:

```sh
pnpm install
Copy-Item .env.example .env
# Generate a signing key with: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
# Set DATABASE_URL and JWT_SECRET (at least 32 random bytes) in .env.
pnpm run migration:up
pnpm run dev
```

Create the initial administrator using one-time environment variables
`ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` (12-128 characters), then
run `pnpm run admin:create`. The password is stored as a scrypt hash; the
command does not log or persist the password. Unset the one-time variables
afterward. There is deliberately no public administrator registration route.

The API listens on `PORT` (3000 in the example environment). The default
`FRONTEND_ORIGINS` allows the local Vite origin `http://localhost:5173`; set it
to a comma-separated list of exact HTTP(S) origins for other environments.
Swagger UI is available at `/api-docs`, and its JSON document at
`/api-docs.json`. The process verifies the PostgreSQL connection before it
starts listening.

Authenticated endpoints require `Authorization: Bearer <accessToken>`.
Administrator access tokens expire after one hour; logout revocations are
stored in PostgreSQL, so run `pnpm run migration:up` after updating an
existing database to create the `revoked_tokens` table.

Database schema changes use MikroORM migrations in `src/database/migrations`.
After changing an entity, run `pnpm run migration:create` to generate a
migration from the difference, review it, then apply it with
`pnpm run migration:up`.
Vehicle CRUD is available at `GET/POST /api/vehicles` and
`GET/PUT/DELETE /api/vehicles/:id`. Requests require a valid administrator
token, and vehicle API responses use `{ "success": true, "data": ... }` or
`{ "success": false, "message": "...", "code": "..." }`. The previous
`/api/v1/vehicles` and `PATCH /:id` paths remain as compatibility aliases.
Use `POST /api/v1/setup/vehicle-device` with `{ "vehicle": { ... },
"device": { ... } }` to validate and create a vehicle and its new assigned
device as a single atomic setup flow.

Run `pnpm run typecheck`, `pnpm test`, and `pnpm run lint` to validate changes.

## Structure

- `src/config` — environment, database, CORS config
- `src/common` — shared constants, errors, middleware, logger, types, utils
- `src/modules` — domain modules (auth, admins, vehicles, devices, tracking, realtime, trips, telemetry, reports, settings, health)
- `src/integrations/gps` — vendor/protocol-agnostic GPS integration boundary
- `src/integrations/simulator` — GPS simulator
- `src/database` — MikroORM config, migrations, seeds
- `src/routes` — root API router
- `tests` — unit, integration, e2e
- `docs` — API, architecture, integration docs

See [the API contract and proposed domain endpoints](./docs/api/api-contract.md)
for current routes, response conventions, and the phase-one integration plan.

## Data flow (planned)

GPS Device / Simulator → GPS Adapter → Ingestion → Validation / Normalization → Vehicle + Device Resolution → Location Processing → PostgreSQL (MikroORM) → Latest Location → Socket.IO → Frontend
