-- Fleet Tracking System — Phase 1 initial schema
-- Run via: pnpm run db:schema:create
-- PostgreSQL >= 14

BEGIN;

-- ============================================================
-- admins
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash TEXT          NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  role          VARCHAR(50)   NOT NULL DEFAULT 'admin',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT admins_role_check CHECK (role IN ('super_admin', 'admin'))
);

-- ============================================================
-- vehicles
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number  VARCHAR(20)   NOT NULL UNIQUE,
  make          VARCHAR(100)  NOT NULL,
  model         VARCHAR(100)  NOT NULL,
  year          SMALLINT      NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicles_status_check CHECK (status IN ('active', 'inactive', 'maintenance')),
  CONSTRAINT vehicles_year_check   CHECK (year >= 1900 AND year <= 2100)
);

-- ============================================================
-- devices
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    VARCHAR(100)  NOT NULL UNIQUE,
  vehicle_id    UUID          REFERENCES vehicles(id) ON DELETE SET NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'unassigned',
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT devices_status_check CHECK (status IN ('active', 'inactive', 'unassigned'))
);

CREATE INDEX IF NOT EXISTS idx_devices_vehicle_id ON devices(vehicle_id);

-- ============================================================
-- location_history  (append-only time-series)
-- ============================================================
CREATE TABLE IF NOT EXISTS location_history (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID              NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id     UUID              NOT NULL REFERENCES devices(id)  ON DELETE CASCADE,
  latitude      DOUBLE PRECISION  NOT NULL,
  longitude     DOUBLE PRECISION  NOT NULL,
  speed         REAL,
  heading       REAL,
  altitude      REAL,
  recorded_at   TIMESTAMPTZ       NOT NULL,
  ingested_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_vehicle_id       ON location_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_location_history_device_id        ON location_history(device_id);
CREATE INDEX IF NOT EXISTS idx_location_history_recorded_at      ON location_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_vehicle_recorded ON location_history(vehicle_id, recorded_at DESC);

-- ============================================================
-- latest_locations  (one row per vehicle, upserted on each ping)
-- ============================================================
CREATE TABLE IF NOT EXISTS latest_locations (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID              NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude      DOUBLE PRECISION  NOT NULL,
  longitude     DOUBLE PRECISION  NOT NULL,
  speed         REAL,
  heading       REAL,
  updated_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ============================================================
-- trips
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID              NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ       NOT NULL,
  ended_at      TIMESTAMPTZ,
  start_lat     DOUBLE PRECISION  NOT NULL,
  start_lng     DOUBLE PRECISION  NOT NULL,
  end_lat       DOUBLE PRECISION,
  end_lng       DOUBLE PRECISION,
  distance_km   DOUBLE PRECISION  NOT NULL DEFAULT 0,
  status        VARCHAR(20)       NOT NULL DEFAULT 'in_progress',
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT trips_status_check CHECK (status IN ('in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_started_at ON trips(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status     ON trips(status);

-- ============================================================
-- telemetry_events
-- ============================================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID          NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id     UUID          NOT NULL REFERENCES devices(id)  ON DELETE CASCADE,
  event_type    VARCHAR(100)  NOT NULL,
  payload       JSONB         NOT NULL DEFAULT '{}',
  recorded_at   TIMESTAMPTZ   NOT NULL,
  ingested_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_id  ON telemetry_events(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_id   ON telemetry_events(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type  ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_events(recorded_at DESC);

-- ============================================================
-- settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(255)  NOT NULL,
  value       JSONB         NOT NULL,
  scope       VARCHAR(20)   NOT NULL DEFAULT 'global',
  vehicle_id  UUID          REFERENCES vehicles(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT settings_scope_check     CHECK (scope IN ('global', 'per_vehicle')),
  CONSTRAINT uq_settings_key_vehicle  UNIQUE (key, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_scope ON settings(scope);

-- Revoked bearer tokens are persisted so logout takes effect across workers.
CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_id   UUID        PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
  ON revoked_tokens(expires_at);

COMMIT;
