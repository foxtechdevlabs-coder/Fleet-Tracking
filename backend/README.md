# Vehicle Tracking Backend

Vehicle Tracking System — Phase 1 backend.

Planned stack: Node.js, Express, TypeScript, PostgreSQL, MikroORM, Socket.IO, Zod.

**Status:** project structure only. No implementation yet.

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

## Data flow (planned)

GPS Device / Simulator → GPS Adapter → Ingestion → Validation / Normalization → Vehicle + Device Resolution → Location Processing → PostgreSQL (MikroORM) → Latest Location → Socket.IO → Frontend
