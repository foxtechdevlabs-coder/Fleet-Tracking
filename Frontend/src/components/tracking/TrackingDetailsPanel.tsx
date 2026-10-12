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
  Truck,
  User,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  type OperationalStatus,
  type Vehicle,
  isValidCoordinate,
  calculateFreshness,
} from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';

export interface TrackingDetailsPanelProps {
  vehicle?: Vehicle | null;
  onClose?: () => void;
  className?: string;
}

/**
 * Calculates compass cardinal direction from degrees (0 - 360)
 */
export function getHeadingCompass(heading?: number | null): {
  degrees: number | null;
  cardinal: string;
  cardinalName: string;
} {
  if (heading === undefined || heading === null || !Number.isFinite(heading) || heading < 0 || heading > 360) {
    return { degrees: null, cardinal: '--', cardinalName: 'Awaiting Fix' };
  }
  const normalized = ((Math.round(heading) % 360) + 360) % 360;
  const directions = [
    { abbr: 'N', name: 'North' },
    { abbr: 'NNE', name: 'North-North-East' },
    { abbr: 'NE', name: 'North-East' },
    { abbr: 'ENE', name: 'East-North-East' },
    { abbr: 'E', name: 'East' },
    { abbr: 'ESE', name: 'East-South-East' },
    { abbr: 'SE', name: 'South-East' },
    { abbr: 'SSE', name: 'South-South-East' },
    { abbr: 'S', name: 'South' },
    { abbr: 'SSW', name: 'South-South-West' },
    { abbr: 'SW', name: 'South-West' },
    { abbr: 'WSW', name: 'West-South-West' },
    { abbr: 'W', name: 'West' },
    { abbr: 'WNW', name: 'West-North-West' },
    { abbr: 'NW', name: 'North-West' },
    { abbr: 'NNW', name: 'North-North-West' },
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return {
    degrees: normalized,
    cardinal: directions[index].abbr,
    cardinalName: directions[index].name,
  };
}

/**
 * Formats coordinates with strict validation and hemisphere notation.
 * Returns hasCoordinates: false for NaN, null, out of range, or Null Island [0,0].
 */
export function formatCoordinates(lat?: number | null, lng?: number | null): {
  latDisplay: string;
  lngDisplay: string;
  hasCoordinates: boolean;
} {
  const valid = isValidCoordinate(lat, lng);
  if (!valid || lat === null || lat === undefined || lng === null || lng === undefined) {
    return {
      latDisplay: 'Unavailable',
      lngDisplay: 'Unavailable',
      hasCoordinates: false,
    };
  }

  const latHemisphere = lat >= 0 ? 'N' : 'S';
  const lngHemisphere = lng >= 0 ? 'E' : 'W';

  return {
    latDisplay: `${Math.abs(lat).toFixed(6)}° ${latHemisphere}`,
    lngDisplay: `${Math.abs(lng).toFixed(6)}° ${lngHemisphere}`,
    hasCoordinates: true,
  };
}

/**
 * Formats speed in km/h with validity check
 */
export function formatSpeed(speed?: number | null): {
  speedDisplay: string;
  isMoving: boolean;
  numericSpeed: number;
} {
  if (speed === undefined || speed === null || !Number.isFinite(speed)) {
    return { speedDisplay: '-- km/h', isMoving: false, numericSpeed: 0 };
  }
  const rounded = Math.max(0, Math.round(speed));
  return {
    speedDisplay: `${rounded} km/h`,
    isMoving: rounded > 0,
    numericSpeed: rounded,
  };
}

/**
 * Formats relative and localized absolute timestamp from real ISO date strings
 */
export function formatTelemetryTime(dateStr?: string | number | Date | null): { relative: string; absolute: string } {
  if (!dateStr) {
    return { relative: 'Awaiting timestamp', absolute: '--' };
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return { relative: 'Awaiting timestamp', absolute: '--' };
  }
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  let relative = 'Just now';
  if (diffSec < 5 && diffSec >= 0) {
    relative = 'Just now';
  } else if (diffSec < 60 && diffSec >= 0) {
    relative = `${diffSec}s ago`;
  } else if (diffSec < 3600 && diffSec >= 0) {
    const mins = Math.floor(diffSec / 60);
    relative = `${mins}m ago`;
  } else if (diffSec < 86400 && diffSec >= 0) {
    const hrs = Math.floor(diffSec / 3600);
    relative = `${hrs}h ago`;
  } else {
    relative = date.toLocaleDateString();
  }

  const absolute = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return { relative, absolute };
}

/**
 * Provides status badge labels and CSS modifier classes
 */
export function getStatusStyle(status?: OperationalStatus) {
  switch (status) {
    case 'MOVING':
      return { label: 'Moving', badgeClass: 'moving', dotClass: 'moving' };
    case 'STOPPED':
      return { label: 'Stopped', badgeClass: 'stopped', dotClass: 'stopped' };
    case 'MAINTENANCE':
      return { label: 'Maintenance', badgeClass: 'maintenance', dotClass: 'maintenance' };
    case 'UNKNOWN':
      return { label: 'Status unavailable', badgeClass: 'offline', dotClass: 'offline' };
    case 'OFFLINE':
    default:
      return { label: 'Offline', badgeClass: 'offline', dotClass: 'offline' };
  }
}

export const TrackingDetailsPanel: React.FC<TrackingDetailsPanelProps> = ({
  vehicle: propVehicle,
  onClose,
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

  // Resolve target vehicle: explicit prop or selectedVehicleId from context
  const activeVehicle: Vehicle | null = useMemo(() => {
    if (propVehicle) return propVehicle;
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
  const statusInfo = getStatusStyle(activeVehicle.operationalStatus);
  const speedInfo = formatSpeed(telemetry?.speed);
  const headingInfo = getHeadingCompass(telemetry?.heading);
  const coordInfo = formatCoordinates(telemetry?.latitude, telemetry?.longitude);

  const pingTimestamp = telemetry?.recordedAt || telemetry?.ingestedAt || activeVehicle.lastKnownLocation?.recordedAt;
  const freshnessInfo = calculateFreshness(pingTimestamp);
  const lastUpdated = formatTelemetryTime(pingTimestamp);

  const hasLiveCoordinates = coordInfo.hasCoordinates;
  const isLocationUnavailable = !hasLiveCoordinates || activeVehicle.locationUnavailable;
  const hasLastKnown = Boolean(
    activeVehicle.lastKnownLocation &&
      isValidCoordinate(activeVehicle.lastKnownLocation.latitude, activeVehicle.lastKnownLocation.longitude)
  );

  const handleCopyCoords = () => {
    if (!hasLiveCoordinates || telemetry?.latitude === undefined || telemetry?.longitude === undefined) return;
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

  return (
    <aside className={`tracking-details-panel ${className}`} aria-label="Vehicle Tracking Details">
      {/* 1. Header Bar: Identity & Status Badges */}
      <div className="tracking-details-header">
        <div className="details-header-meta">
          <div className="vehicle-avatar">
            <Truck size={18} />
          </div>
          <div className="vehicle-title-group">
            <div className="vehicle-id-row">
              <span className="vehicle-id-badge">{activeVehicle.id}</span>
              <span className="plate-badge">{activeVehicle.plateNumber}</span>
              {isLocationUnavailable && (
                <span className="location-unavailable-pill" title="GPS coordinates missing or unverified">
                  <MapPinOff size={11} />
                  <span>Location Unavailable</span>
                </span>
              )}
            </div>
            <span className="vehicle-make-model">
              {activeVehicle.make} {activeVehicle.model} {activeVehicle.year ? `(${activeVehicle.year})` : ''}
            </span>
          </div>
        </div>

        <div className="details-header-actions">
          {/* Freshness Badge: Live vs Stale vs Offline */}
          <span className={`freshness-badge ${freshnessInfo.badgeClass}`} title={freshnessInfo.subtext}>
            <span className={`freshness-dot ${freshnessInfo.dotClass}`} />
            {freshnessInfo.label}
          </span>

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

      {/* 2. Stream Status Ribbon & Warning Notice */}
      <div
        className={`telemetry-stream-banner ${
          isLocationUnavailable
            ? 'banner-warning'
            : freshnessInfo.freshness === 'stale'
            ? 'banner-stale'
            : freshnessInfo.freshness === 'offline'
            ? 'banner-offline'
            : 'banner-live'
        }`}
      >
        <div className="stream-indicator">
          {isLocationUnavailable ? (
            <MapPinOff size={14} />
          ) : freshnessInfo.freshness === 'stale' ? (
            <AlertTriangle size={14} />
          ) : freshnessInfo.freshness === 'offline' ? (
            <AlertCircle size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>
            {isLocationUnavailable
              ? 'GPS Location Unavailable'
              : freshnessInfo.freshness === 'stale'
              ? 'Stale Telemetry Feed (Outdated)'
              : freshnessInfo.freshness === 'offline'
              ? 'Telemetry Feed Offline'
              : 'Live Telemetry Feed (Active)'}
          </span>
        </div>
        <div className="stream-timestamp">
          <Clock size={12} />
          <span>Last ping: {lastUpdated.relative}</span>
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
        <section className="details-section" aria-label="Vehicle Telemetry">
          <div className="section-title-row">
            <Activity size={14} />
            <h4>Coordinates &amp; Telemetry Stream</h4>
          </div>

          <div className="telemetry-hud-grid">
            {/* Speed Field */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">SPEED</span>
                <Gauge size={13} color="#0284c7" />
              </div>
              <div className="metric-value-wrap">
                <span className="metric-value highlight">{speedInfo.speedDisplay}</span>
              </div>
              <div className="speed-meter-track" aria-hidden="true">
                <div
                  className="speed-meter-fill"
                  style={{ width: `${Math.min(100, (speedInfo.numericSpeed / 120) * 100)}%` }}
                />
              </div>
              <span className="metric-subtext">
                {freshnessInfo.freshness === 'stale'
                  ? 'Historical (Stale ping)'
                  : freshnessInfo.freshness === 'offline'
                  ? 'Offline state'
                  : telemetry?.speed == null
                  ? 'Unavailable'
                  : speedInfo.isMoving
                  ? 'In Transit'
                  : 'Stationary'}
              </span>
            </div>

            {/* Heading Field */}
            <div className="hud-metric-card">
              <div className="metric-header">
                <span className="metric-title">HEADING / BEARING</span>
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
                  {headingInfo.degrees !== null ? `${headingInfo.degrees}°` : '--'}
                </span>
                <span className="metric-tag">{headingInfo.cardinal}</span>
              </div>
              <span className="metric-subtext">
                {headingInfo.degrees !== null ? `Vector ${headingInfo.cardinal}` : 'Awaiting bearing'}
              </span>
            </div>

            {/* GNSS Coordinates Card (handles Location Unavailable & Last Known Location) */}
            <div className="hud-metric-card full-width">
              <div className="metric-header">
                <span className="metric-title">GNSS COORDINATES</span>
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
                {hasLiveCoordinates
                  ? 'WGS84 High-Precision Verified Fix'
                  : hasLastKnown
                  ? 'Displaying historical fix — Real-time position currently unavailable'
                  : 'Zero GPS coordinate packets received from device'}
              </span>
            </div>

            {/* Last Updated Field */}
            <div className="hud-metric-card full-width">
              <div className="metric-header">
                <span className="metric-title">TELEMETRY FRESHNESS &amp; INGESTION</span>
                <Clock size={13} color="#0284c7" />
              </div>
              <div className="metric-value-wrap">
                <span className="metric-value">{lastUpdated.relative}</span>
                <span className="timestamp-tag">{lastUpdated.absolute}</span>
              </div>
              <span className="metric-subtext">
                {telemetry?.recordedAt
                  ? `Device Reported: ${new Date(telemetry.recordedAt).toLocaleString()}`
                  : activeVehicle.lastKnownLocation?.recordedAt
                  ? `Last Valid Ping: ${new Date(activeVehicle.lastKnownLocation.recordedAt).toLocaleString()}`
                  : 'Awaiting initial telemetry ingestion'}
              </span>
            </div>
          </div>
        </section>

        {/* 4. Vehicle Information Fields */}
        <section className="details-section" aria-label="Vehicle Information">
          <div className="section-title-row">
            <Truck size={14} />
            <h4>Vehicle Information</h4>
          </div>

          <div className="fields-key-value-list">
            <div className="kv-row">
              <span className="kv-key">Vehicle ID</span>
              <span className="kv-val mono">{activeVehicle.id}</span>
            </div>

            <div className="kv-row">
              <span className="kv-key">License Plate</span>
              <span className="kv-val mono">{activeVehicle.plateNumber}</span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Make &amp; Model</span>
              <span className="kv-val">{activeVehicle.make} {activeVehicle.model}</span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Model Year</span>
              <span className="kv-val">
                {activeVehicle.year ? (
                  <span className="badge-subtle">
                    <Calendar size={11} /> {activeVehicle.year}
                  </span>
                ) : (
                  '--'
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Assigned Driver</span>
              <span className="kv-val">
                <span className="driver-display">
                  <User size={13} />
                  <span>{activeVehicle.driverName || 'Driver unassigned'}</span>
                </span>
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Driver Contact</span>
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
                  <span className="text-muted-fallback">Contact unavailable</span>
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

        {/* 5. Device & Hardware Information Fields */}
        <section className="details-section" aria-label="Device Information">
          <div className="section-title-row">
            <Cpu size={14} />
            <h4>Device &amp; Telematics Unit</h4>
          </div>

          <div className="fields-key-value-list">
            <div className="kv-row">
              <span className="kv-key">Device Identifier / IMEI</span>
              <span className="kv-val">
                {activeVehicle.deviceId ? (
                  <div className="device-id-wrap">
                    <span className="mono">{activeVehicle.deviceId}</span>
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
                  <span className="text-muted-fallback">Unregistered Device</span>
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
                  <span className="text-muted-fallback">--</span>
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
                  <span className="text-muted-fallback">-- V</span>
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
                  <span className="text-muted-fallback">--%</span>
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
                  <span className="text-muted-fallback">--</span>
                )}
              </span>
            </div>

            <div className="kv-row">
              <span className="kv-key">Odometer Reading</span>
              <span className="kv-val mono">
                {telemetry?.odometerKm !== undefined
                  ? `${telemetry.odometerKm.toLocaleString()} km`
                  : '-- km'}
              </span>
            </div>

            {telemetry?.engineRpm !== undefined && (
              <div className="kv-row">
                <span className="kv-key">Engine RPM</span>
                <span className="kv-val mono">{telemetry.engineRpm.toLocaleString()} RPM</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 6. Footer Details Summary */}
      <div className="tracking-details-footer">
        <div className="protocol-indicator">
          <Zap size={12} color="#0284c7" />
          <span>Real-time API Stream • Zero Mock Fallbacks</span>
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
