import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
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
  MapPinOff,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  Satellite,
  Signal,
  Truck,
  User,
  WifiOff,
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
export function getHeadingCompass(heading?: number | null): { degrees: number | null; cardinal: string } {
  if (heading === undefined || heading === null || isNaN(heading)) {
    return { degrees: null, cardinal: '--' };
  }
  const normalized = ((Math.round(numericHeading) % 360) + 360) % 360;
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return { degrees: normalized, cardinal: directions[index] };
}

/**
 * Formats coordinates with strict validation and hemisphere notation.
 * Returns hasCoordinates: false for NaN, null, out of range, or Null Island [0,0].
 */
export function formatCoordinates(lat?: number | string | null, lng?: number | string | null): {
  latDisplay: string;
  lngDisplay: string;
  hasCoordinates: boolean;
} {
  const hasLat = lat !== undefined && lat !== null && Number.isFinite(lat);
  const hasLng = lng !== undefined && lng !== null && Number.isFinite(lng);

  if (!hasLat || !hasLng) {
    return {
      latDisplay: '--',
      lngDisplay: '--',
      hasCoordinates: false,
    };
  }

  const latHemisphere = (lat as number) >= 0 ? 'N' : 'S';
  const lngHemisphere = (lng as number) >= 0 ? 'E' : 'W';

  return {
    latDisplay: `${Math.abs(lat as number).toFixed(6)}° ${latHemisphere}`,
    lngDisplay: `${Math.abs(lng as number).toFixed(6)}° ${lngHemisphere}`,
    hasCoordinates: true,
  };
}

/**
 * Formats speed in km/h with validity check
 */
export function formatSpeed(speed?: number | string | null, isOffline?: boolean): {
  speedDisplay: string;
  isMoving: boolean;
  numericSpeed: number;
} {
  if (speed === undefined || speed === null || isNaN(speed)) {
    return { speedDisplay: '-- km/h', isMoving: false, numericSpeed: 0 };
  }

  const rounded = Math.max(0, Math.round(numericSpeed));
  return {
    speedDisplay: `${rounded} km/h`,
    isMoving: rounded > 0,
    numericSpeed: rounded,
  };
}

/**
 * Formats relative and localized absolute timestamp from real ISO date strings with staleness detection.
 */
export function formatTelemetryTime(dateStr?: string): { relative: string; absolute: string } {
  if (!dateStr) {
    return { relative: 'No Handshake', absolute: '—', isStale: false };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { relative: 'Awaiting timestamp', absolute: '--' };
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
      return { label: 'Offline', badgeClass: 'offline', dotClass: 'offline' };
    default:
      return { label: 'Status Unavailable', badgeClass: 'unknown', dotClass: 'unknown' };
  }
}

export const TrackingDetailsPanel: React.FC<TrackingDetailsPanelProps> = ({
  vehicle: propVehicle,
  onClose,
  onCenterMap,
  className = '',
}) => {
  const {
    vehicles,
    selectedVehicleId,
    isLoading,
    isRefreshing,
    trackingState,
    apiError,
    refreshTelemetry,
    retryTracking,
  } = useFleet();

  const [copiedCoords, setCopiedCoords] = useState(false);
  const [copiedLastKnown, setCopiedLastKnown] = useState(false);
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
            {isLoading || trackingState === 'retrying' ? (
              <Radio size={32} color="#0284c7" className="spin-anim" />
            ) : apiError ? (
              <WifiOff size={32} color="#ef4444" />
            ) : (
              <Radio size={32} color="#94a3b8" />
            )}
          </div>

          <h3>
            {isLoading
              ? 'Loading tracking data'
              : trackingState === 'retrying'
                ? 'Retrying connection...'
                : apiError
                  ? `Tracking service error (${apiError.status || 'Offline'})`
                  : 'No vehicle selected'}
          </h3>

          <p>
            {apiError
              ? apiError.friendlyMessage
              : isLoading
                ? 'Retrieving vehicle telemetry records from the cluster.'
                : 'Select an asset from the fleet matrix or map to view live telemetry.'}
          </p>

          {apiError?.actionableAdvice && (
            <p className="error-actionable-hint">{apiError.actionableAdvice}</p>
          )}

          {apiError && apiError.canRetry && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void retryTracking()}
              disabled={trackingState === 'retrying'}
            >
              <RefreshCw size={14} className={trackingState === 'retrying' ? 'spin-anim' : ''} />
              <span>{trackingState === 'retrying' ? 'Retrying...' : 'Retry Connection'}</span>
            </button>
          )}
        </div>
      </aside>
    );
  }

  const telemetry = activeVehicle.telemetry;
  const latitude = parseFiniteNumber(telemetry?.latitude);
  const longitude = parseFiniteNumber(telemetry?.longitude);
  const speed = parseFiniteNumber(telemetry?.speed);
  const heading = parseFiniteNumber(telemetry?.heading);
  const isOffline = activeVehicle.operationalStatus === 'OFFLINE';
  const statusInfo = getStatusStyle(activeVehicle.operationalStatus);
  const speedInfo = formatSpeed(telemetry?.speed);
  const headingInfo = getHeadingCompass(telemetry?.heading);
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

  const handleCopyLastKnownCoords = () => {
    if (!hasLastKnown || !activeVehicle.lastKnownLocation) return;
    const text = `${activeVehicle.lastKnownLocation.latitude.toFixed(6)}, ${activeVehicle.lastKnownLocation.longitude.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    setCopiedLastKnown(true);
    setTimeout(() => setCopiedLastKnown(false), 2000);
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
  const complianceStatus = activeVehicle.complianceStatus || 'Not reported';
  // Carrier ID
  const carrierId = activeVehicle.carrierId || '—';

  return (
    <aside className={`tracking-details-panel ${className}`} aria-label="Vehicle Tracking Details">
      {/* 1. Header Bar: Identity & Status */}
      <div className="tracking-details-header">
        <div className="details-header-meta">
          <div className="vehicle-avatar">
            <Truck size={18} />
          </div>
          <div className="vehicle-title-group">
            <div className="vehicle-id-row">
              <span className="vehicle-id-badge">{activeVehicle.id}</span>
              <span className="plate-badge">{activeVehicle.plateNumber}</span>
            </div>
          </div>
        </div>

        <div className="details-header-actions">
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
      <div className={`telemetry-stream-banner ${hasTelemetry ? 'active' : 'awaiting'}`}>
        <div className="stream-indicator">
          {hasTelemetry ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>
            {hasTelemetry ? 'Live GNSS Fix Acquired' : 'Awaiting GPS Fix — Signal Pending'}
          </span>
        </div>
        <div className="stream-timestamp">
          <span>
            {isOffline
              ? (hasTelemetry ? `Last Fix: ${lastUpdated.relative}` : 'No Handshake')
              : hasTelemetry
                ? (telemetry?.gnssFixType || (typeof telemetry?.satelliteCount === 'number' ? `GNSS: ${telemetry.satelliteCount} satellites` : 'GNSS details unavailable'))
                : 'Awaiting Signal'}
          </span>
        </div>
      </div>

      {/* API Error Alert Bar (if operational error occurred during stream) */}
      {apiError && (
        <div className="telemetry-error-alert" role="alert">
          <div className="error-alert-content">
            <AlertCircle size={15} color="#ef4444" />
            <div className="error-alert-text">
              <strong>{apiError.status ? `HTTP ${apiError.status}: ` : ''}{apiError.friendlyMessage}</strong>
              {apiError.actionableAdvice && <span>{apiError.actionableAdvice}</span>}
            </div>
          </div>
          {apiError.canRetry && (
            <button
              type="button"
              className="btn-retry-compact"
              onClick={() => void retryTracking()}
              disabled={trackingState === 'retrying'}
            >
              <RefreshCw size={12} className={trackingState === 'retrying' ? 'spin-anim' : ''} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      <div className="tracking-details-scrollable">
        {/* 3. Primary Telemetry Metrics Grid (Speed, Heading, Coordinates, Last Updated) */}
        <section className="details-section" aria-label="Live Telemetry">
          <div className="section-title-row">
            <Activity size={14} />
            <h4>Live Coordinates &amp; Dynamics</h4>
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
                {speedInfo.isMoving ? 'In Transit' : 'Stationary'}
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

            {/* Latitude & Longitude Fields */}
            <div className="hud-metric-card full-width">
              <div className="metric-header">
                <span className="metric-title">3. GNSS COORDINATES &amp; FIX</span>
                <div className="coords-header-actions">
                  <MapPin size={13} color="#0284c7" />
                  {hasLiveCoordinates && (
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

              {hasLiveCoordinates ? (
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
              ) : (
                <div className="location-unavailable-card">
                  <div className="unavailable-pill-badge">
                    <MapPinOff size={13} />
                    <span>Location Unavailable</span>
                  </div>
                  <p className="unavailable-explanation">
                    No active satellite lock. Synthetic coordinates are prohibited.
                  </p>
                </div>
              )}

              {/* Explicit Last Known Location section if current coordinates unavailable */}
              {isLocationUnavailable && hasLastKnown && activeVehicle.lastKnownLocation && (
                <div className="last-known-location-box">
                  <div className="last-known-box-header">
                    <span className="last-known-title">
                      <Clock size={11} />
                      LAST KNOWN VALID LOCATION
                    </span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={handleCopyLastKnownCoords}
                      title="Copy last known coordinates"
                      aria-label="Copy last known coordinates"
                    >
                      {copiedLastKnown ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                      <span>{copiedLastKnown ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="coords-dual-display last-known-display">
                    <div className="coord-item">
                      <span className="coord-label">LAT</span>
                      <span className="coord-value">
                        {formatCoordinates(activeVehicle.lastKnownLocation.latitude, activeVehicle.lastKnownLocation.longitude).latDisplay}
                      </span>
                    </div>
                    <div className="coord-separator">•</div>
                    <div className="coord-item">
                      <span className="coord-label">LNG</span>
                      <span className="coord-value">
                        {formatCoordinates(activeVehicle.lastKnownLocation.latitude, activeVehicle.lastKnownLocation.longitude).lngDisplay}
                      </span>
                    </div>
                  </div>
                  <span className="last-known-timestamp">
                    Recorded {formatTelemetryTime(activeVehicle.lastKnownLocation.recordedAt).relative} (
                    {new Date(activeVehicle.lastKnownLocation.recordedAt).toLocaleString()})
                  </span>
                </div>
              )}

              <span className="metric-subtext">
                {hasTelemetry ? 'WGS84 High Precision Fix' : 'No GPS coordinate packet received'}
              </span>
            </div>

            {/* Metric 4: Odometer & Run */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">LAST TELEMETRY UPDATE</span>
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
                  {isOffline ? 'Offline' : (telemetry?.signalGrade || '—')}
                </span>
              </div>
              <span className="metric-subtext">
                {telemetry?.recordedAt
                  ? `Recorded at: ${new Date(telemetry.recordedAt).toLocaleString()}`
                  : telemetry?.ingestedAt
                    ? `Ingested at: ${new Date(telemetry.ingestedAt).toLocaleString()}`
                    : 'Pending first telemetry ingestion'}
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
                  <span>{activeVehicle.driverName || 'Driver Unassigned'}</span>
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
                  <span className="text-muted-fallback">No phone on record</span>
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
          <span>Real-time API Bound • Zero Mock Values</span>
        </div>
        <button
          type="button"
          className="refresh-details-btn"
          onClick={() => void refreshTelemetry()}
          disabled={isRefreshing}
          title="Refresh telemetry"
        >
          <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </aside>
  );
};
