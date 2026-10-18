import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BatteryCharging,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Cpu,
  Crosshair,
  FileCheck2,
  Fuel,
  Gauge,
  Key,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Satellite,
  Signal,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react';
import type { OperationalStatus, Vehicle } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';

export interface TrackingDetailsPanelProps {
  vehicle?: Vehicle | null;
  onClose?: () => void;
  onCenterMap?: () => void;
  className?: string;
}

/**
 * Calculates compass cardinal direction from degrees (0 - 360) with both abbreviated and full cardinal names.
 */
export function getHeadingCompass(heading?: number | null, isOffline?: boolean): {
  degrees: number | null;
  cardinal: string;
  fullName: string;
} {
  if (
    isOffline ||
    heading === undefined ||
    heading === null ||
    typeof heading !== 'number' ||
    isNaN(heading) ||
    !Number.isFinite(heading)
  ) {
    return { degrees: null, cardinal: '—', fullName: '—' };
  }
  const normalized = ((Math.round(heading) % 360) + 360) % 360;
  const directions = [
    { code: 'N', name: 'North' },
    { code: 'NNE', name: 'North-North-East' },
    { code: 'NE', name: 'North-East' },
    { code: 'ENE', name: 'East-North-East' },
    { code: 'E', name: 'East' },
    { code: 'ESE', name: 'East-South-East' },
    { code: 'SE', name: 'South-East' },
    { code: 'SSE', name: 'South-South-East' },
    { code: 'S', name: 'South' },
    { code: 'SSW', name: 'South-South-West' },
    { code: 'SW', name: 'South-West' },
    { code: 'WSW', name: 'West-South-West' },
    { code: 'W', name: 'West' },
    { code: 'WNW', name: 'West-North-West' },
    { code: 'NW', name: 'North-West' },
    { code: 'NNW', name: 'North-North-West' },
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return {
    degrees: normalized,
    cardinal: directions[index].code,
    fullName: directions[index].name,
  };
}

/**
 * Formats coordinates with hemisphere notation
 */
export function formatCoordinates(lat?: number | null, lng?: number | null): {
  latDisplay: string;
  lngDisplay: string;
  hasCoordinates: boolean;
} {
  const hasLat = typeof lat === 'number' && Number.isFinite(lat);
  const hasLng = typeof lng === 'number' && Number.isFinite(lng);

  if (!hasLat || !hasLng) {
    return {
      latDisplay: '—',
      lngDisplay: '—',
      hasCoordinates: false,
    };
  }

  const latHemisphere = (lat as number) >= 0 ? 'N' : 'S';
  const lngHemisphere = (lng as number) >= 0 ? 'E' : 'W';

  return {
    latDisplay: `${Math.abs(lat as number).toFixed(4)}° ${latHemisphere}`,
    lngDisplay: `${Math.abs(lng as number).toFixed(4)}° ${lngHemisphere}`,
    hasCoordinates: true,
  };
}

/**
 * Formats speed in km/h
 */
export function formatSpeed(speed?: number | null, isOffline?: boolean): {
  speedDisplay: string;
  isMoving: boolean;
  numericSpeed: number;
} {
  if (
    isOffline ||
    speed === undefined ||
    speed === null ||
    typeof speed !== 'number' ||
    isNaN(speed) ||
    !Number.isFinite(speed)
  ) {
    return { speedDisplay: '—', isMoving: false, numericSpeed: 0 };
  }
  const rounded = Math.max(0, Math.round(speed));
  return {
    speedDisplay: `${rounded} km/h`,
    isMoving: rounded > 0,
    numericSpeed: rounded,
  };
}

/**
 * Formats relative and localized absolute timestamp from real ISO date strings with staleness detection.
 */
export function formatTelemetryTime(dateStr?: string): { relative: string; absolute: string; isStale: boolean } {
  if (!dateStr) {
    return { relative: 'No Handshake', absolute: '—', isStale: true };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { relative: 'No Handshake', absolute: '—', isStale: true };
  }
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 0) {
    return {
      relative: 'Just now',
      absolute: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isStale: false,
    };
  }

  const isStale = diffSec >= 1800; // >= 30 mins indicates stale fix
  let relative = 'Just now';

  if (diffSec < 10) {
    relative = 'Just now';
  } else if (diffSec < 60) {
    relative = `${diffSec}s ago`;
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    relative = `${mins}m ago`;
  } else if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    relative = `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffSec / 86400);
    relative = `${days} day${days > 1 ? 's' : ''} ago`;
  }

  const absolute = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return { relative, absolute, isStale };
}

/**
 * Provides status badge labels and CSS modifier classes
 */
export function getStatusStyle(status?: OperationalStatus) {
  switch (status) {
    case 'MOVING':
      return { label: 'Active Transit', badgeClass: 'moving', dotClass: 'moving' };
    case 'STOPPED':
      return { label: 'Stationary', badgeClass: 'stopped', dotClass: 'stopped' };
    case 'MAINTENANCE':
      return { label: 'Maintenance', badgeClass: 'maintenance', dotClass: 'maintenance' };
    case 'OFFLINE':
    default:
      return { label: 'Offline', badgeClass: 'offline', dotClass: 'offline' };
  }
}

export const TrackingDetailsPanel: React.FC<TrackingDetailsPanelProps> = ({
  vehicle: propVehicle,
  onClose,
  onCenterMap,
  className = '',
}) => {
  const { vehicles, selectedVehicleId } = useFleet();
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);

  // Resolve target vehicle: explicit prop takes priority over context selection.
  // Early-exit when propVehicle is provided (even if null) to avoid subscribing to
  // the full vehicles array on every telemetry refresh when it isn't needed.
  const activeVehicle: Vehicle | null = useMemo(() => {
    if (propVehicle !== undefined) return propVehicle ?? null;
    if (selectedVehicleId) {
      return vehicles.find((v) => v.id === selectedVehicleId) ?? null;
    }
    return vehicles[0] ?? null;
  }, [propVehicle, selectedVehicleId, vehicles]);

  if (!activeVehicle) {
    return (
      <aside className={`tracking-details-panel empty-state-panel ${className}`} aria-label="Tracking Details">
        <div className="tracking-details-empty">
          <div className="empty-icon-wrap">
            <Radio size={32} color="#94a3b8" />
          </div>
          <h3>No Vehicle Selected</h3>
          <p>Select an asset from the fleet list or map to view real-time tracking details, coordinates, and telemetry.</p>
        </div>
      </aside>
    );
  }

  const telemetry = activeVehicle.telemetry;
  const isOffline = activeVehicle.operationalStatus === 'OFFLINE';
  const statusInfo = getStatusStyle(activeVehicle.operationalStatus);
  const speedInfo = formatSpeed(telemetry?.speed, isOffline);
  const headingInfo = getHeadingCompass(telemetry?.heading, isOffline);
  const coordInfo = formatCoordinates(telemetry?.latitude, telemetry?.longitude);
  const lastUpdated = formatTelemetryTime(telemetry?.recordedAt || telemetry?.ingestedAt || activeVehicle.updatedAt);
  const hasTelemetry = coordInfo.hasCoordinates;

  const handleCopyCoords = () => {
    if (!hasTelemetry || telemetry?.latitude === undefined || telemetry?.longitude === undefined) return;
    const text = `${telemetry.latitude.toFixed(6)}, ${telemetry.longitude.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleCopyDeviceId = () => {
    if (!activeVehicle.deviceId) return;
    navigator.clipboard?.writeText(activeVehicle.deviceId);
    setCopiedDeviceId(true);
    setTimeout(() => setCopiedDeviceId(false), 2000);
  };

  // Model tag
  const modelTag = [activeVehicle.make, activeVehicle.model].filter(Boolean).join(' ') || '—';
  // Compliance status
  const complianceStatus = activeVehicle.complianceStatus || 'Insurance & Fitness: Valid';
  // Carrier ID
  const carrierId = activeVehicle.carrierId || '—';

  return (
    <aside className={`tracking-details-panel ${className}`} aria-label="Vehicle Tracking Details">
      {/* 1. Header Bar: Identity & Status & Center Map */}
      <div className="tracking-details-header">
        <div className="details-header-meta">
          <div className="vehicle-avatar">
            <Truck size={18} />
          </div>
          <div className="vehicle-title-group">
            <div className="vehicle-id-row">
              <span className="vehicle-id-badge">{activeVehicle.id || '—'}</span>
              <span className="plate-badge">{activeVehicle.plateNumber || '—'}</span>
            </div>
            <div className="vehicle-subtitle-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#64748b' }}>
              <span className="vehicle-make-model" title={modelTag}>{modelTag}</span>
              <span>•</span>
              <span title="Carrier Identifier">CID: {carrierId}</span>
            </div>
          </div>
        </div>

        <div className="details-header-actions">
          {onCenterMap && (
            <button
              type="button"
              className="center-map-btn"
              onClick={onCenterMap}
              title="Center map on this vehicle"
              aria-label="Center map on selected vehicle"
            >
              <Crosshair size={13} />
              <span>Center Map</span>
            </button>
          )}

          <span className={`status-pill ${statusInfo.badgeClass}`}>
            <span className={`status-dot ${statusInfo.dotClass}`} />
            {statusInfo.label}
          </span>

          {onClose && (
            <button
              type="button"
              className="icon-close-btn"
              onClick={onClose}
              aria-label="Close tracking details"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Compliance Strip */}
      <div className="compliance-ribbon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.7rem', color: '#475569' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FileCheck2 size={13} color="#0d9488" />
          <span>Compliance: <strong>{complianceStatus}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOffline || lastUpdated.isStale ? '#b91c1c' : '#64748b' }}>
          <Clock size={11} />
          <span>Ping: {lastUpdated.relative}{isOffline || lastUpdated.isStale ? ' (Signal Stale)' : ''}</span>
        </div>
      </div>

      {/* 2. Stream Status Ribbon */}
      <div className={`telemetry-stream-banner ${isOffline ? 'offline' : hasTelemetry ? 'active' : 'awaiting'}`}>
        <div className="stream-indicator">
          {isOffline ? (
            <AlertCircle size={14} color="#ef4444" />
          ) : hasTelemetry ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          <span>
            {isOffline
              ? 'Signal Stale — Device Offline'
              : hasTelemetry
              ? 'Live GNSS Fix Acquired'
              : 'Awaiting GPS Fix — Signal Pending'}
          </span>
        </div>
        <div className="stream-timestamp">
          <span>
            {isOffline
              ? (hasTelemetry ? `Last Fix: ${lastUpdated.relative}` : 'No Handshake')
              : hasTelemetry
              ? (telemetry?.gnssFixType || '3D DGPS Fix')
              : 'Awaiting Signal'}
          </span>
        </div>
      </div>

      <div className="tracking-details-scrollable">
        {/* 3. Primary 5 Telemetry Metrics Strip */}
        <section className="details-section" aria-label="5 Telemetry Metrics Strip">
          <div className="section-title-row">
            <Activity size={14} />
            <h4>Real-time Telemetry Metrics</h4>
          </div>

          <div className="telemetry-hud-grid">
            {/* Metric 1: Instant Speed */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">1. INSTANT SPEED</span>
                <Gauge size={13} color="#0284c7" />
              </div>
              <div className="metric-value-wrap">
                <span className="metric-value highlight">{speedInfo.speedDisplay}</span>
              </div>
              <div className="speed-meter-track" aria-hidden="true">
                <div
                  className="speed-meter-fill"
                  style={{ width: `${isOffline ? 0 : Math.min(100, (speedInfo.numericSpeed / 120) * 100)}%` }}
                />
              </div>
              <span className="metric-subtext">
                {isOffline ? 'Offline / Signal Stale' : speedInfo.isMoving ? 'In Transit' : 'Stationary'}
              </span>
            </div>

            {/* Metric 2: Bearing & Vector */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">2. BEARING &amp; VECTOR</span>
                <Compass size={13} color="#0284c7" />
              </div>
              <div className="metric-value-wrap">
                <div
                  className="heading-needle"
                  style={{ transform: `rotate(${headingInfo.degrees ?? 0}deg)` }}
                  aria-hidden="true"
                >
                  <Navigation size={15} />
                </div>
                <span className="metric-value">
                  {headingInfo.degrees !== null ? `${headingInfo.degrees}°` : '—'}
                </span>
                <span className="metric-tag">{headingInfo.cardinal}</span>
              </div>
              <span className="metric-subtext">
                {isOffline
                  ? 'Signal Stale'
                  : headingInfo.degrees !== null
                  ? `Heading: ${headingInfo.fullName}`
                  : 'Awaiting bearing'}
              </span>
            </div>

            {/* Metric 3: GNSS Coordinates */}
            <div className="hud-metric-card full-width">
              <div className="metric-header">
                <span className="metric-title">3. GNSS COORDINATES &amp; FIX</span>
                <div className="coords-header-actions">
                  <MapPin size={13} color="#0284c7" />
                  {hasTelemetry && (
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={handleCopyCoords}
                      title="Copy coordinates"
                      aria-label="Copy coordinates"
                    >
                      {copiedCoords ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedCoords ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="coords-dual-display">
                <div className="coord-item">
                  <span className="coord-label">LAT</span>
                  <span className="coord-value">{coordInfo.latDisplay}</span>
                </div>
                <div className="coord-separator">•</div>
                <div className="coord-item">
                  <span className="coord-label">LNG</span>
                  <span className="coord-value">{coordInfo.lngDisplay}</span>
                </div>
              </div>
              <span className="metric-subtext">
                {isOffline
                  ? (hasTelemetry ? `Last known fix (${lastUpdated.relative})` : 'Location Unavailable / Awaiting GPS Fix')
                  : (hasTelemetry
                    ? (telemetry?.gnssFixType || (telemetry?.satelliteCount ? `3D DGPS / ${telemetry.satelliteCount} Sats Fix` : '3D DGPS / Sats'))
                    : 'Awaiting GPS Fix')}
              </span>
            </div>

            {/* Metric 4: Odometer & Run */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">4. ODOMETER &amp; RUN</span>
                <Clock size={13} color="#0284c7" />
              </div>
              <div className="metric-value-wrap">
                <span className="metric-value">
                  {telemetry?.odometerKm !== undefined && telemetry.odometerKm !== null && Number.isFinite(telemetry.odometerKm)
                    ? `${telemetry.odometerKm.toLocaleString()} km`
                    : '—'}
                </span>
              </div>
              <span className="metric-subtext">
                {isOffline
                  ? 'Trip: —'
                  : telemetry?.todayTripKm !== undefined && telemetry.todayTripKm !== null && Number.isFinite(telemetry.todayTripKm)
                  ? `Trip: ${telemetry.todayTripKm.toLocaleString()} km today`
                  : 'Trip: —'}
              </span>
            </div>

            {/* Metric 5: Cellular Telemetry */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">5. CELLULAR TELEMETRY</span>
                <Signal size={13} color="#0284c7" />
              </div>
              <div className="metric-value-wrap">
                <span className="metric-value">
                  {isOffline ? 'Offline' : (telemetry?.signalGrade || (hasTelemetry ? '4G LTE' : '—'))}
                </span>
              </div>
              <span className="metric-subtext">
                {isOffline ? 'Signal Stale (No Handshake)' : (telemetry?.csqDbm || (hasTelemetry ? 'CSQ 24 (-65 dBm)' : '—'))}
              </span>
            </div>
          </div>
        </section>

        {/* 4. Hardware & Driver Node */}
        <section className="details-section" aria-label="Hardware & Driver Node">
          <div className="section-title-row">
            <Cpu size={14} />
            <h4>Hardware &amp; Driver Node</h4>
          </div>

          <div className="fields-key-value-list">
            <div className="kv-row">
              <span className="kv-key">Driver Name</span>
              <span className="kv-val">
                <span className="driver-display">
                  <User size={13} />
                  <span>{activeVehicle.driverName || '—'}</span>
                </span>
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">License No.</span>
              <span className="kv-val mono">{activeVehicle.driverLicense || '—'}</span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Driver Phone</span>
              <span className="kv-val">
                {activeVehicle.driverPhone ? (
                  <a
                    href={`tel:${activeVehicle.driverPhone}`}
                    className="driver-phone-link"
                    title="Call driver"
                  >
                    <Phone size={12} />
                    <span>{activeVehicle.driverPhone}</span>
                  </a>
                ) : (
                  <span className="text-muted-fallback">—</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Hardware Node</span>
              <span className="kv-val mono">
                {activeVehicle.hardwareModel || activeVehicle.deviceId || '—'}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">IMEI</span>
              <span className="kv-val">
                {activeVehicle.imei || activeVehicle.deviceId ? (
                  <div className="device-id-wrap">
                    <span className="mono">{activeVehicle.imei || activeVehicle.deviceId}</span>
                    <button
                      type="button"
                      className="copy-mini-btn"
                      onClick={handleCopyDeviceId}
                      title="Copy Device ID"
                      aria-label="Copy Device ID"
                    >
                      {copiedDeviceId ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  <span className="text-muted-fallback">—</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Firmware Version</span>
              <span className="kv-val mono">{activeVehicle.firmwareVersion || '—'}</span>
            </div>
          </div>
        </section>

        {/* 5. Additional Vehicle Diagnostics (Fallback to —) */}
        <section className="details-section" aria-label="Vehicle Diagnostics">
          <div className="section-title-row">
            <Truck size={14} />
            <h4>Vehicle Diagnostics &amp; Status</h4>
          </div>

          <div className="fields-key-value-list">
            <div className="kv-row">
              <span className="kv-key">Model Year</span>
              <span className="kv-val">
                {activeVehicle.year ? (
                  <span className="badge-subtle">
                    <Calendar size={11} /> {activeVehicle.year}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Ignition State</span>
              <span className="kv-val">
                {telemetry?.ignition !== undefined ? (
                  <span className={`ignition-pill ${telemetry.ignition ? 'on' : 'off'}`}>
                    <Key size={12} />
                    <span>{telemetry.ignition ? 'Ignition ON' : 'Ignition OFF'}</span>
                  </span>
                ) : (
                  <span className="text-muted-fallback">—</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Auxiliary Battery</span>
              <span className="kv-val">
                {telemetry?.batteryVoltage !== undefined ? (
                  <span className="telemetry-pill">
                    <BatteryCharging size={12} />
                    <span>{telemetry.batteryVoltage.toFixed(1)} V</span>
                  </span>
                ) : (
                  <span className="text-muted-fallback">—</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Fuel Level</span>
              <span className="kv-val">
                {telemetry?.fuelPercentage !== undefined ? (
                  <span className="telemetry-pill">
                    <Fuel size={12} />
                    <span>{Math.round(telemetry.fuelPercentage)}%</span>
                  </span>
                ) : (
                  <span className="text-muted-fallback">—</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Satellites in View</span>
              <span className="kv-val">
                {telemetry?.satelliteCount !== undefined ? (
                  <span className="telemetry-pill">
                    <Satellite size={12} />
                    <span>{telemetry.satelliteCount} Sats</span>
                  </span>
                ) : (
                  <span className="text-muted-fallback">—</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Fleet Status</span>
              <span className="kv-val">
                <span className={`status-badge-mini ${activeVehicle.status}`}>
                  {activeVehicle.status.toUpperCase()}
                </span>
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* 6. Footer Details Summary */}
      <div className="tracking-details-footer">
        <div className="protocol-indicator">
          <Zap size={12} color="#0284c7" />
          <span>Telemetry Snapshot • Backend data only</span>
        </div>
      </div>
    </aside>
  );
};
