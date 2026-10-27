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
`VEHICLE_IDENTIFIER_EXISTS`, request bodies over 1 MB are `413` with
`PAYLOAD_TOO_LARGE`, and unexpected failures are `500` with
`INTERNAL_SERVER_ERROR`. Validation messages name the field and the problem
(for example `latitude is required`, `latitude must be a number`, or
`status must be one of: active, inactive, maintenance`) and report the first
invalid field only. The health probe and `204` logout/delete responses
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
schema change is required to resolve that association.

`location_history` retains valid readings even when they arrive out of order.
`latest_locations` changes only when the incoming `recordedAt` is newer than
the timestamp of the position currently stored for that Vehicle. Older or
same-time readings therefore cannot replace the current position. No age-based
stale-reading cutoff is defined. Its `recorded_at` value is backfilled from
the newest valid history row for each Vehicle by the accompanying migration.

`recordedAt` must be a valid ISO 8601 timestamp with a timezone, and may be at
most `GPS_MAX_CLOCK_SKEW_SECONDS` (default 300) ahead of the server clock;
later timestamps are rejected with `400 VALIDATION_ERROR`, so a device with a
wrong clock cannot pin a Vehicle's live position in the future and block every
correct reading after it. Delayed and out-of-order (older) readings have no
age limit and are still stored. Latitude and
longitude must be within [-90, 90] and [-180, 180]. Supplied speed must be
finite and non-negative; heading must be within [0, 360]; altitude must be
finite. `speed`, `heading` and `altitude` may be omitted or sent as `null`
when the device does not report them; both are stored as `null`. Invalid input is rejected with `400 VALIDATION_ERROR` before
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
location-history persistence. Repeated ingestions with the same registered
Device and `recordedAt` return the original record; a unique database index
protects this idempotency key under concurrent requests. After the transaction
commits, a reading that became the Vehicle's live position is broadcast as a
`vehicle:location` Socket.IO event (see "Realtime vehicle locations");
duplicates and older readings are not broadcast. No vendor protocol or
hardware-specific payload is assumed.

## Latest vehicle locations

`GET /api/v1/tracking/latest` requires an administrator bearer token and returns
the stored live position of each Vehicle from `latest_locations`, ordered by
`vehicleId`: `vehicleId`, `latitude`, `longitude`, nullable `speed` and
`heading`, `recordedAt`, and `updatedAt`. The optional `vehicleIds` query
parameter is a comma-separated list of 1-500 Vehicle UUIDs; without it, all
Vehicles with a position are returned. Unknown IDs and Vehicles without a
position are omitted. Malformed IDs or unsupported query parameters return
`400 VALIDATION_ERROR`. Clients use it for the map's initial load and after a
realtime reconnect, to catch up on events missed while disconnected.

The GET form is kept for compatibility, but the query string is limited by the
server's 16 KB request-header limit: more than about 430 UUIDs is rejected by
Node with `431 Request Header Fields Too Large` (not a JSON error) before the
API runs. For longer lists use the POST form.

`POST /api/v1/tracking/latest` requires an administrator bearer token and
returns the same data for the IDs in a JSON body:

```json
{ "vehicleIds": ["22222222-2222-4222-8222-222222222222"] }
```

- `vehicleIds` must be a JSON array of strings (a comma-separated string is not
  accepted) and no other body fields are allowed.
- IDs are trimmed and lowercased, and duplicates are removed **before** the
  limit is applied: 1-500 unique UUIDs, from at most 1000 raw entries.
- Unknown IDs and Vehicles without a position are omitted; a request with only
  unknown IDs returns `200` with an empty `data` array.
- Empty arrays, empty or malformed IDs, more than 500 unique IDs, more than 1000
  entries, or extra fields return `400 VALIDATION_ERROR` in the standard error
  envelope. The endpoint is read-only.

## Realtime vehicle locations

Socket.IO is served by the same HTTP server and port as the API, at the default
path `/socket.io`, with the same CORS origins (`FRONTEND_ORIGINS`).

- **Authentication:** connect with `io(apiOrigin, { auth: { token } })` using
  the administrator access token (a `Bearer ` prefix is optional). The token is
  checked like `requireAdmin`: signature, expiry, active administrator, and
  not revoked. Tokens are not accepted in the URL. Refusals arrive as
  `connect_error` whose `message` is the error code and whose `data` says
  whether retrying helps (see "Errors and retry").
- **Subscriptions:** a socket receives updates only for Vehicles it subscribes
  to. Emit `vehicles:subscribe` with `{ vehicleIds: string[] }` and an
  acknowledgement callback; the reply is
  `{ ok: true, subscribed: string[], unknown: string[] }` (`subscribed` is the
  socket's full set after the request, `unknown` lists valid UUIDs with no such
  Vehicle) or `{ ok: false, error: { code, message, retryable, retryAfterMs? } }`. A request may carry
  1-500 IDs and a socket may follow at most 500 Vehicles; only existing
  Vehicles the socket does not already follow count toward that cap, and the cap
  holds even for concurrent subscribe requests (otherwise
  `TOO_MANY_SUBSCRIPTIONS`, not retryable). `vehicles:unsubscribe`
  takes the same payload. Each subscribe re-checks the session; an invalid
  session is answered with `UNAUTHORIZED` and disconnected.
- **`vehicle:location`:** sent to subscribers of that Vehicle only, after the
  ingestion transaction commits and only when the reading became the live
  position. Payload: `locationId`, `vehicleId`, `deviceId`, `latitude`,
  `longitude`, nullable `speed`, `heading`, and `altitude`, and ISO 8601
  `recordedAt` and `ingestedAt`. Clients should ignore an event whose
  `recordedAt` is not newer than the position they display, or whose
  `locationId` they already applied.
- **Session end:** when the access token expires, or on
  `POST /api/v1/auth/logout` with that token, the server emits
  `session:ended` with `{ reason: "token_expired" | "logged_out" | "unauthorized" }`
  and disconnects the socket. Clients should log in again rather than reconnect
  with the same token.
- **Errors and retry:** every socket error says whether retrying can help.

  | Code | Where | `retryable` | Client action |
  | --- | --- | --- | --- |
  | `UNAUTHORIZED` | `connect_error`, subscribe ack | `false` | Token missing, invalid, expired or revoked, or admin inactive: send the admin to login. |
  | `SERVICE_UNAVAILABLE` | `connect_error`, subscribe ack | `true` | The server could not check the session or run the request (e.g. database outage). The token was **not** judged invalid: keep the session and retry after `retryAfterMs` (2000), with backoff. A subscribe failure leaves the socket connected. |
  | `TOO_MANY_REQUESTS` | subscribe ack | `true` | Retry after `retryAfterMs` (60000). |
  | `VALIDATION_ERROR`, `TOO_MANY_SUBSCRIPTIONS` | subscribe ack | `false` | Fix the request. |

  socket.io-client does **not** reconnect by itself after a `connect_error`
  from the server's authentication step, so the client must do it:

  ```ts
  socket.on("connect_error", (err) => {
    const data = err.data as { retryable?: boolean; retryAfterMs?: number } | undefined;
    if (data?.retryable) {
      setTimeout(() => socket.connect(), Math.max(data.retryAfterMs ?? 2000, backoffMs()));
    } else if (err.message === "UNAUTHORIZED") {
      logout(); // only here; never for SERVICE_UNAVAILABLE
    }
    // Other connect_error messages (network, TOO_MANY_CONNECTION* 403s) are
    // retried automatically by socket.io-client's own reconnection.
  });
  ```

  REST requests behave the same way: an authentication check that cannot reach
  the database returns `500 INTERNAL_SERVER_ERROR`, not `401`, so clients should
  log out only on `401`.
- **Reconnect:** on every (re)connect, re-emit `vehicles:subscribe`, then call
  `POST /api/v1/tracking/latest` with the subscribed Vehicle IDs (the GET form
  works for up to about 430 IDs).
- **Abuse limits** (per process, configurable in `.env`): per client IP, at most
  `SOCKET_CONNECTIONS_PER_MINUTE` (default 30) new connection attempts per
  minute and `SOCKET_MAX_CONNECTIONS_PER_IP` (default 20) open connections.
  Both are checked before authentication; refused handshakes get HTTP 403 with
  `{ "code": 4, "message": "TOO_MANY_CONNECTION_ATTEMPTS" | "TOO_MANY_CONNECTIONS" }`,
  which socket.io-client reports as `connect_error`. Each socket may send at most
  `SOCKET_SUBSCRIPTIONS_PER_MINUTE` (default 30) subscribe/unsubscribe requests
  per minute; more are answered with `TOO_MANY_REQUESTS` without further work.
  Messages over 64 KB close the connection, and a connection that does not
  complete the Socket.IO handshake within 10 seconds is dropped. Invalid,
  forged or expired tokens are rejected without a database query. Clients
  should reconnect with backoff (socket.io-client's default).
- **Limits:** rooms and connections live in one process's memory. Running more
  than one API instance requires a shared Socket.IO adapter (for example Redis).

## Location reports

`GET /api/v1/reports/locations` requires an administrator bearer token and
reads records from the existing `location_history` table. Optional `from` and
`to` filters are inclusive ISO 8601 timestamps with a timezone. Optional
`vehicleId` must identify an existing Vehicle, and `deviceIdentifier` must
match a registered Device. All supplied filters are applied together at the
database query layer. Invalid filters return `400`; unknown Vehicles or
Devices return `404`; a valid filter set with no matching rows returns an
empty `data` array. Results are ordered by `recordedAt` ascending, with a
stable tie-breaker for records sharing the same timestamp.

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
- **Live updates:** Socket.IO `vehicle:location` events are implemented for
  live positions (see "Realtime vehicle locations"). Trip-change events are not
  implemented.
- **Authentication:** administrator login, logout revocation, current-profile
  lookup, and protected vehicle/device routes are implemented. Public signup,
  password reset, token refresh, and role-specific authorization are not
  implemented.
