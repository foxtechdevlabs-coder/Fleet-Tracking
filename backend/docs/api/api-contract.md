# API contract and integration plan

## Implemented contract

The API is served from the backend origin on the configured `PORT` (3000 in the
example environment). Domain APIs use `/api`; the versioned `/api/v1` aliases
remain available for previously exposed resources.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | None | `200 { "status": "ok" }` |
| `GET` | `/health` | None | Same response; compatibility alias |
| `GET` | `/api-docs.json` | None | OpenAPI 3.0.3 document |
| `GET` | `/api-docs` | None | Swagger UI |

The health route indicates that the HTTP process is responding. It is not a
database readiness check. The server bootstrap separately checks PostgreSQL
before opening the HTTP listener.

## Implemented admin, vehicle, and device endpoints

Authentication, Device, and combined setup routes below are implemented under
`/api/v1`. Except for login, they require an active administrator bearer token.
Vehicle CRUD is available under the canonical `/api/vehicles` path (and remains
available under `/api/v1/vehicles` for compatibility).

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | JSON `{ "email": "...", "password": "..." }` | `200 { "data": { "accessToken", "tokenType": "Bearer", "expiresIn": 3600, "admin": { "id", "email", "name", "role" } } }` |
| `POST` | `/auth/logout` | Bearer token | `204`; token is persistently revoked |
| `GET` | `/auth/me` | Bearer token | `200 { "data": { "id", "email", "name", "role" } }` |
| `GET` | `/api/vehicles?page=1&limit=25` | Bearer token; optional pagination; limit 1-100 | `200 { "success": true, "data": [...], "meta": { "page", "limit", "total" } }` |
| `POST` | `/api/vehicles` | Bearer token; `plateNumber`, `make`, `model`, `year`; optional `status` | `201 { "success": true, "data": vehicle }` |
| `GET`, `PUT`, `DELETE` | `/api/vehicles/{id}` | Bearer token; UUID path parameter; PUT requires all vehicle fields except optional status | `200 { "success": true, "data": vehicle }` for GET/PUT; `204` for DELETE |
| `PATCH` | `/api/vehicles/{id}` | Compatibility partial update; Bearer token and UUID path parameter | `200 { "success": true, "data": vehicle }` |
| `GET` | `/devices?page=1&limit=25` | Optional pagination; limit 1-100 | `200 { "data": [...], "meta": { "page", "limit", "total" } }` |
| `POST` | `/devices` | `identifier`; optional `vehicleId`, `status` | `201 { "data": device }` |
| `GET`, `PATCH`, `DELETE` | `/devices/{id}` | UUID path parameter; PATCH accepts `identifier`, `vehicleId` (UUID or null), or `status` | `200 { "data": device }` for GET/PATCH; `204` for DELETE |
| `POST` | `/setup/vehicle-device` | `{ "vehicle": { "plateNumber", "make", "model", "year", "status?" }, "device": { "identifier", "status?" } }` | `201 { "data": { "vehicle": ..., "device": ... } }`; both are saved atomically |

Vehicle statuses are `active`, `inactive`, and `maintenance`. Plate numbers
are trimmed and uppercased. Vehicle years must be from 1900 through 2100.
Device statuses are `active`, `inactive`, and `unassigned`; newly registered
devices default to `unassigned`. Duplicate vehicle plates and device
identifiers return `409`; invalid input returns `400`; missing records return
`404`; unauthenticated or revoked credentials return `401`. Vehicle API errors
use `{ "success": false, "message": "...", "code": "..." }`; unexpected errors
return `500` without exposing internal details. Invalid vehicle IDs are rejected
with `400` before a database lookup.
The combined setup endpoint validates all required vehicle/device fields and
formats before opening its database transaction. It assigns the newly created
device to the newly created vehicle; callers cannot supply a separate
`vehicleId` in this flow. Device status defaults to `active` and must be
`active` or `inactive`; an `unassigned` device is not valid for combined setup.
Any persistence failure rolls back both records.

The persisted `Vehicle` model consists of UUID `id`, unique `plateNumber`,
`make`, `model`, `year`, `status`, and `createdAt`/`updatedAt` timestamps. A
`Device` consists of UUID `id`, unique `identifier`, nullable `vehicleId`,
`status`, nullable read-only `lastSeenAt`, and `createdAt`/`updatedAt`
timestamps. `vehicleId` references `vehicles.id` and is cleared by the database
if the vehicle is removed. Vehicle and device deletes follow the documented
database foreign-key cascade behavior for dependent tracking data.

Create the first administrator through the backend-only `pnpm run admin:create`
command after setting its one-time `ADMIN_EMAIL`, `ADMIN_NAME`, and
`ADMIN_PASSWORD` environment variables. Login uses scrypt password hashes.
Access tokens are signed with `JWT_SECRET` and expire after one hour; logout
revocation is stored in PostgreSQL.

## Proposed phase-one resource endpoints

The modules below are grounded in the current database schema and data-flow
outline. They are API design targets, not live routes. Payloads and
authorization rules should be finalized as those domain modules are
implemented.

| Method | Path | Purpose / initial request fields |
| --- | --- | --- |
| `GET` | `/api/v1/tracking/vehicles/{vehicleId}/latest` | Return the most recent known coordinates and update time. |
| `GET` | `/api/v1/tracking/vehicles/{vehicleId}/history` | Query location history with `from`, `to`, `limit`, and `cursor`. |
| `POST` | `/api/v1/tracking/ingest` | Accept normalized device telemetry: `deviceIdentifier`, `recordedAt`, `latitude`, `longitude`, and optional `speed`, `heading`, `altitude`. |
| `GET`, `POST` | `/api/v1/trips` | List or create trips; creation associates a `vehicleId` and start coordinates/time. |
| `GET`, `POST` | `/api/v1/telemetry` | Query events or ingest an event with `deviceId`, `eventType`, `recordedAt`, and `payload`. |
| `GET` | `/api/v1/reports/trips` | Generate trip summaries, filtered by date range and optional vehicle. |
| `GET`, `PATCH` | `/api/v1/settings` | Read and update global or per-vehicle settings. |

For other implemented resource routes, use JSON request/response bodies with
their documented response shapes. The health endpoint intentionally remains a
small process probe.

## Integration boundaries

- **Frontend:** call the backend at its configured origin under `/api` for the
  canonical vehicle endpoints, or `/api/v1` for compatibility resources.
  Configure the frontend development proxy or API base URL in the frontend
  project; this backend setup does not modify frontend files. CORS permits the
  exact comma-separated HTTP(S) origins in `FRONTEND_ORIGINS`, defaulting to
  `http://localhost:5173`.
- **Persistence:** PostgreSQL is the system of record. Schema creation is
  explicit via `pnpm run db:schema:create`; server startup checks connectivity
  and fails rather than silently starting without the database.
- **GPS devices:** preserve the existing vendor-neutral GPS adapter boundary.
  Normalize vendor input before location persistence; do not assume a device
  vendor or wire protocol.
- **Live updates:** the architecture plans Socket.IO events for new locations
  and trip changes. Socket.IO is not yet installed or exposed to clients.
- **Authentication:** administrator login, logout revocation, current-profile
  lookup, and protected vehicle/device routes are implemented. Public signup,
  password reset, token refresh, and role-specific authorization are not
  implemented.
