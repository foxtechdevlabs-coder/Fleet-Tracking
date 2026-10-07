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

Canonical Device and Vehicle JSON successes use
`{ "success": true, "message": "...", "data": ... }`; paginated lists also
include `meta`. Create responses use HTTP `201` and messages
`Device created successfully` or `Vehicle created successfully`. Errors use
`{ "success": false, "message": "...", "code": "..." }`: validation is `400`
with `VALIDATION_ERROR`, authentication is `401` with `UNAUTHORIZED`, duplicate
Device/Vehicle identifiers are `409` with `DEVICE_IDENTIFIER_EXISTS` or
`VEHICLE_IDENTIFIER_EXISTS`, and unexpected failures are `500` with
`INTERNAL_SERVER_ERROR`. The health probe and `204` logout/delete responses
intentionally remain bodyless/dedicated contracts.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | JSON `{ "email": "...", "password": "..." }` | `200 { "data": { "accessToken", "tokenType": "Bearer", "expiresIn": 3600, "admin": { "id", "email", "name", "role" } } }` |
| `POST` | `/auth/logout` | Bearer token | `204`; token is persistently revoked |
| `GET` | `/auth/me` | Bearer token | `200 { "data": { "id", "email", "name", "role" } }` |
| `GET` | `/api/vehicles?page=1&limit=25` | Bearer token; optional pagination; limit 1-100 | `200 { "success": true, "data": [...], "meta": { "page", "limit", "total" } }` |
| `POST` | `/api/vehicles` | Bearer token; `plateNumber`, `make`, `model`, `year`; optional `status` | `201 { "success": true, "data": vehicle }` |
| `GET`, `PUT`, `DELETE` | `/api/vehicles/{id}` | Bearer token; UUID path parameter; PUT requires all vehicle fields except optional status | `200 { "success": true, "data": vehicle }` for GET/PUT; `204` for DELETE |
| `PATCH` | `/api/vehicles/{id}` | Compatibility partial update; Bearer token and UUID path parameter | `200 { "success": true, "data": vehicle }` |
| `GET` | `/api/devices?page=1&limit=25` | Bearer token; optional pagination; limit 1-100 | `200 { "data": [...], "meta": { "page", "limit", "total" } }` |
| `GET` | `/api/devices/{id}` | Bearer token; UUID path parameter | `200 { "data": device }` |
| `PUT` | `/api/devices/{id}` | Bearer token; required `identifier`; optional `vehicleId` and `status` | `200 { "data": device }` |
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
Creation validation requires non-empty `plateNumber`, `make`, `model`, and an
integer `year` from 1900 through 2100 for vehicles, and a non-empty
`identifier` for devices. Vehicle plate numbers are trimmed and uppercased;
device identifiers are trimmed and limited to 100 characters. Optional
`status` fields must be in their respective enum, and an optional Device
`vehicleId` must be a UUID or `null` and refer to an existing vehicle.
Repositories are preceded by service-level duplicate checks; the database
unique indexes remain the concurrency-safe final guard.

Both identifier constraints are already present in the MikroORM entities and
`src/database/migrations/001_initial_schema.sql`; no new migration is needed.
For a new/initial database, use `pnpm run db:schema:create`. This script is
idempotent for the existing schema but does not retrofit changed DDL into
already-created tables; verify the existing unique indexes when upgrading an
older database.

Device routes are also mounted under `/api/v1/devices` for compatibility.
Device PUT accepts only the existing entity's writable master fields:
`identifier`, `vehicleId`, and `status`. `identifier` is required; omitted
optional values remain unchanged. `id`, `lastSeenAt`, timestamps, and arbitrary
fields are rejected. Device identifiers are trimmed and must contain 1-100
characters; a non-null `vehicleId` must be a UUID referencing an existing
vehicle.

Vehicle and device update repositories assign only validated master-data
properties and flush the existing entity. They do not query or write
`location_history` or `telemetry_events`; `lastSeenAt` is read-only for Device
PUT. The API tests snapshot history rows and assert that both location and
telemetry data remain unchanged across master-data updates.
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

## Tracking ingestion

`POST /api/v1/tracking/ingest` is an authenticated normalized location endpoint.
It requires an active administrator bearer token and accepts
`deviceIdentifier`, `recordedAt`, `latitude`, `longitude`, with optional
`speed`, `heading`, and `altitude`. The identifier is trimmed, matched to the
registered `Device.identifier`, and the vehicle is resolved only from that
Device's stored `vehicle_id`. Caller-supplied database IDs or additional
payload fields are rejected. Unknown identifiers return `404
DEVICE_NOT_FOUND`. An unassigned Device is rejected with `409
DEVICE_NOT_ASSIGNED`, because `location_history.vehicle_id` is required. A
dangling stored association returns `409
DEVICE_VEHICLE_ASSOCIATION_INVALID`. Valid data is written to
`location_history` and upserted into `latest_locations` in the same
transaction. The live position is resolved exclusively from the registered
Device's Vehicle association; no Device or Vehicle is created and no database
schema change is required.

`recordedAt` must be a valid ISO 8601 timestamp with a timezone. Latitude and
longitude must be within [-90, 90] and [-180, 180]. Supplied speed must be
finite and non-negative; heading must be within [0, 360]; altitude must be
finite. Invalid input is rejected with `400 VALIDATION_ERROR` before
persistence. Successful requests return `201` with a standard success envelope
and the persisted location-history record. Validation and relationship errors
occur before either table changes.

Example request:

```json
{
  "deviceIdentifier": "GPS-001",
  "recordedAt": "2026-10-07T05:20:00.000Z",
  "latitude": 51.5072,
  "longitude": -0.1276,
  "speed": 32.5,
  "heading": 180,
  "altitude": 15
}
```

The existing `src/modules/tracking/location.processor.ts` remains a placeholder;
the new endpoint service performs validation, registered-device resolution, and
location-history persistence. No vendor protocol or hardware-specific payload
is assumed.

## Location reports

`GET /api/v1/reports/locations` requires an administrator bearer token and
reads records from the existing `location_history` table. Optional `from` and
`to` filters are inclusive ISO 8601 timestamps with a timezone. Optional
`vehicleId` must identify an existing Vehicle, and `deviceIdentifier` must
match a registered Device. All supplied filters are applied together at the
database query layer. Invalid filters return `400`; unknown Vehicles or
Devices return `404`; a valid filter set with no matching rows returns an
empty `data` array.

Each report row preserves stored valid coordinates, includes nullable
`speed`, `heading`, and `altitude` as stored, and safely returns null for
missing or out-of-range coordinates. Speed uses the stored km/h units and
heading uses degrees. No values are synthesized.

## Proposed phase-one resource endpoints

The endpoints below are design targets based on the existing schema. Payloads
and authorization rules should be finalized as the domain modules are
implemented.

| Method | Path | Purpose / initial request fields |
| --- | --- | --- |
| `GET` | `/api/v1/tracking/vehicles/{vehicleId}/latest` | Return the most recent known coordinates and update time. |
| `GET` | `/api/v1/tracking/vehicles/{vehicleId}/history` | Query location history with `from`, `to`, `limit`, and `cursor`. |
| `GET`, `POST` | `/api/v1/trips` | List or create trips; creation associates a `vehicleId` and start coordinates/time. |
| `GET`, `POST` | `/api/v1/telemetry` | Query events or ingest an event with `deviceId`, `eventType`, `recordedAt`, and `payload`. |
| `GET` | `/api/v1/reports/locations` | Implemented location report, filtered by date range, Vehicle, and registered Device identifier. |
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
  explicit via MikroORM migrations (`pnpm run migration:up`); server startup checks connectivity
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
