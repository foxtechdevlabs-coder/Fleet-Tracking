import React, { useMemo, useState, useCallback } from 'react';
import {
  Clock,
  MapPinOff,
  MapPinned,
  Pause,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wifi,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { MapViewport } from '../dashboard/MapViewport';
import { TrackingDetailsPanel, formatTelemetryTime } from './TrackingDetailsPanel';
import {
  isValidCoordinate,
  calculateFreshness,
} from '../../types/telemetry';

type ExtendedFilter = 'ALL' | 'MOVING' | 'STOPPED' | 'OFFLINE' | 'STALE' | 'NO_FIX';

export const LiveTrackingView: React.FC = () => {
  const {
    vehicles,
    isLoading,
    isRefreshing,
    trackingState,
    apiError,
    error,
    refreshTelemetry,
    retryTracking,
    selectedVehicleId,
    setSelectedVehicleId,
    isLivePolling,
    setIsLivePolling,
  } = useFleet();

  const isRetrying = trackingState === 'retrying';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExtendedFilter>('ALL');
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  // Memoized vehicle filtering with search, operational status, freshness, and coordinate validity
  const filteredVehicles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      // 1. Filter match
      let matchesFilter = true;
      if (activeFilter === 'MOVING') {
        matchesFilter = vehicle.operationalStatus === 'MOVING';
      } else if (activeFilter === 'STOPPED') {
        matchesFilter = vehicle.operationalStatus === 'STOPPED';
      } else if (activeFilter === 'OFFLINE') {
        matchesFilter = vehicle.operationalStatus === 'OFFLINE' || vehicle.freshness === 'offline';
      } else if (activeFilter === 'STALE') {
        matchesFilter = vehicle.freshness === 'stale';
      } else if (activeFilter === 'NO_FIX') {
        const hasCoords = Boolean(
          vehicle.telemetry && isValidCoordinate(vehicle.telemetry.latitude, vehicle.telemetry.longitude)
        );
        matchesFilter = !hasCoords || Boolean(vehicle.locationUnavailable);
      }

      // 2. Search query match
      const searchableText = [
        vehicle.id,
        vehicle.plateNumber,
        vehicle.driverName ?? '',
        vehicle.model,
        vehicle.make,
        vehicle.deviceId ?? '',
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);

      return matchesFilter && matchesSearch;
    });
  }, [searchQuery, activeFilter, vehicles]);

  // Resolve selected vehicle safely
  const selectedVehicle = useMemo(() => {
    if (selectedVehicleId) {
      const match = vehicles.find((v) => v.id === selectedVehicleId);
      if (match) return match;
    }
    return filteredVehicles[0] ?? vehicles[0] ?? null;
  }, [selectedVehicleId, vehicles, filteredVehicles]);

  // Synchronize selection safely on list filter updates
  React.useEffect(() => {
    if (
      filteredVehicles.length > 0 &&
      selectedVehicleId &&
      !filteredVehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    ) {
      setSelectedVehicleId(filteredVehicles[0].id);
    }
  }, [filteredVehicles, selectedVehicleId, setSelectedVehicleId]);

  const handleSelectVehicle = useCallback(
    (vehicleId: string) => {
      setSelectedVehicleId(vehicleId);
    },
    [setSelectedVehicleId]
  );

  // Status counts for tabs
  const counts = useMemo(() => {
    return {
      ALL: vehicles.length,
      MOVING: vehicles.filter((v) => v.operationalStatus === 'MOVING').length,
      STOPPED: vehicles.filter((v) => v.operationalStatus === 'STOPPED').length,
      OFFLINE: vehicles.filter((v) => v.operationalStatus === 'OFFLINE' || v.freshness === 'offline').length,
      STALE: vehicles.filter((v) => v.freshness === 'stale').length,
      NO_FIX: vehicles.filter((v) => {
        const hasCoords = Boolean(
          v.telemetry && isValidCoordinate(v.telemetry.latitude, v.telemetry.longitude)
        );
        return !hasCoords || Boolean(v.locationUnavailable);
      }).length,
    };
  }, [vehicles]);

  return (
    <div className={`live-tracking-shell ${isDetailsOpen ? 'with-details' : ''}`}>
      <aside className="asset-matrix-panel" aria-label="Fleet Tracking Asset Matrix">
        {/* 1. Header Bar with live polling indicator & controls */}
        <div className="matrix-panel-header">
          <div className="matrix-title-group">
            <h2>Live Asset Matrix</h2>
            <span className="pill-counter">{vehicles.length || 0} Units</span>
            <button
              type="button"
              className={`live-stream-toggle ${isLivePolling ? 'active' : 'paused'}`}
              onClick={() => setIsLivePolling(!isLivePolling)}
              title={isLivePolling ? 'Pause real-time telemetry polling' : 'Resume real-time telemetry polling'}
              aria-label="Toggle live polling"
            >
              {isLivePolling ? <span className="pulse-dot-green" /> : <Pause size={10} />}
              <span>{isLivePolling ? 'LIVE' : 'PAUSED'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className={`icon-button ${isDetailsOpen ? 'active' : ''}`}
              aria-label="Toggle tracking details panel"
              title={isDetailsOpen ? 'Hide Tracking Details' : 'Show Tracking Details'}
              onClick={() => setIsDetailsOpen((prev) => !prev)}
            >
              <SlidersHorizontal size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Refresh asset matrix"
              title="Refresh asset matrix"
              onClick={() => void refreshTelemetry()}
              disabled={isRefreshing || trackingState === 'retrying'}
            >
              <RefreshCw size={15} className={isRefreshing || trackingState === 'retrying' ? 'spin-anim' : ''} />
            </button>
          </div>
        </div>

        {/* 2. Search Toolbar */}
        <div className="matrix-toolbar">
          <label className="search-input-box matrix-search-box" aria-label="Filter vehicles">
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              value={searchQuery}
              placeholder="Search ID, Reg, Driver, Model..."
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>

        {/* 3. Filter Tabs (Moving, Stopped, Offline, Stale, Location Unavailable) */}
        <div className="status-tabs matrix-tabs" aria-label="Vehicle status filters">
          <button
            type="button"
            className={`status-tab ${activeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
          >
            All
            <span className="tab-count">{counts.ALL}</span>
          </button>
          <button
            type="button"
            className={`status-tab ${activeFilter === 'MOVING' ? 'active' : ''}`}
            onClick={() => setActiveFilter('MOVING')}
          >
            • Moving
            <span className="tab-count">{counts.MOVING}</span>
          </button>
          <button
            type="button"
            className={`status-tab ${activeFilter === 'STOPPED' ? 'active' : ''}`}
            onClick={() => setActiveFilter('STOPPED')}
          >
            • Stopped
            <span className="tab-count">{counts.STOPPED}</span>
          </button>
          <button
            type="button"
            className={`status-tab ${activeFilter === 'OFFLINE' ? 'active' : ''}`}
            onClick={() => setActiveFilter('OFFLINE')}
          >
            • Offline
            <span className="tab-count">{counts.OFFLINE}</span>
          </button>
          {counts.STALE > 0 && (
            <button
              type="button"
              className={`status-tab tab-stale ${activeFilter === 'STALE' ? 'active' : ''}`}
              onClick={() => setActiveFilter('STALE')}
            >
              • Stale
              <span className="tab-count">{counts.STALE}</span>
            </button>
          )}
          {counts.NO_FIX > 0 && (
            <button
              type="button"
              className={`status-tab tab-nofix ${activeFilter === 'NO_FIX' ? 'active' : ''}`}
              onClick={() => setActiveFilter('NO_FIX')}
            >
              • No GPS
              <span className="tab-count">{counts.NO_FIX}</span>
            </button>
          )}
        </div>

        {/* 4. Matrix Vehicle Cards List / Error & Empty States */}
        <div className="matrix-list">
          {isLoading && vehicles.length === 0 ? (
            <div className="matrix-empty-state" role="status">
              <RefreshCw size={24} className="spin-anim" />
              <h3>Connecting to Telematics API</h3>
              <p>Establishing real-time session and loading registered fleet assets.</p>
            </div>
          ) : trackingState === 'error' && vehicles.length === 0 ? (
            <div className="matrix-empty-state error-state-box" role="alert">
              <ShieldAlert size={32} color="#ef4444" />
              <div className="error-status-badge">
                {apiError?.status ? `HTTP ${apiError.status}` : 'SERVICE OFFLINE'}
              </div>
              <h3>{apiError?.friendlyMessage || error || 'Fleet Telemetry Unavailable'}</h3>
              {apiError?.actionableAdvice && (
                <p className="error-advice-text">{apiError.actionableAdvice}</p>
              )}
              {(trackingState === 'error' || isRetrying) && apiError?.canRetry !== false && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void retryTracking()}
                  disabled={isRetrying}
                >
                  <RefreshCw size={14} className={isRetrying ? 'spin-anim' : ''} />
                  <span>{isRetrying ? 'Retrying Connection...' : 'Retry Now'}</span>
                </button>
              )}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="matrix-empty-state">
              <MapPinned size={28} color="#94a3b8" />
              <h3>No registered fleet vehicles</h3>
              <p>The FleetTrack API returned zero registered vehicle units.</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="matrix-empty-state">
              <MapPinned size={28} color="#94a3b8" />
              <h3>No matching assets</h3>
              <p>No vehicles match the selected filter criteria or search query.</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const isSelected = selectedVehicle?.id === vehicle.id;
              const hasCoords = Boolean(
                vehicle.telemetry &&
                  isValidCoordinate(vehicle.telemetry.latitude, vehicle.telemetry.longitude)
              );
              const isLocationUnavailable = !hasCoords || Boolean(vehicle.locationUnavailable);
              const hasLastKnown = Boolean(
                vehicle.lastKnownLocation &&
                  isValidCoordinate(vehicle.lastKnownLocation.latitude, vehicle.lastKnownLocation.longitude)
              );

              const pingTimestamp =
                vehicle.telemetry?.recordedAt ||
                vehicle.telemetry?.ingestedAt ||
                vehicle.lastKnownLocation?.recordedAt;
              const freshness = calculateFreshness(pingTimestamp);
              const lastPingFormatted = formatTelemetryTime(pingTimestamp);

              const speedDisplay =
                hasCoords && vehicle.telemetry?.speed != null && Number.isFinite(vehicle.telemetry.speed)
                  ? `${Math.round(vehicle.telemetry.speed)} km/h`
                  : '-- km/h';

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  className={`matrix-card ${isSelected ? 'selected' : ''} ${
                    isLocationUnavailable ? 'card-loc-unavailable' : ''
                  }`}
                  onClick={() => handleSelectVehicle(vehicle.id)}
                >
                  <div className="matrix-card-header">
                    <div className="vehicle-mini-icon">
                      <Truck size={14} />
                    </div>
                    <div className="matrix-card-meta">
                      <div className="matrix-id-pill-row">
                        <span className="matrix-vehicle-id">{vehicle.id}</span>
                        <span className={`freshness-badge-micro ${freshness.badgeClass}`}>
                          {freshness.label}
                        </span>
                      </div>
                      <span className="matrix-plate">{vehicle.plateNumber}</span>
                    </div>
                    <span className={`matrix-speed ${vehicle.operationalStatus.toLowerCase()}`}>
                      {speedDisplay}
                    </span>
                  </div>

                  <div className="matrix-card-body">
                    <span className="matrix-model">{vehicle.model || 'Unspecified model'}</span>
                    <div className="matrix-metadata-row">
                      <span>
                        {hasCoords && vehicle.telemetry?.heading !== undefined
                          ? `Hdg ${vehicle.telemetry.heading}°`
                          : 'Heading unavailable'}
                      </span>
                      <span>
                        {vehicle.telemetry?.batteryVoltage !== undefined
                          ? `${vehicle.telemetry.batteryVoltage.toFixed(0)}V Aux`
                          : '-- Aux'}
                      </span>
                    </div>
                    <div className="matrix-driver-row">
                      <span>{vehicle.driverName ?? 'Driver Unassigned'}</span>
                    </div>
                  </div>

                  {/* Card Footer: Location status & Last Ping */}
                  <div className="matrix-card-footer">
                    <span className="ping-time-cell">
                      <Clock size={11} /> {lastPingFormatted.relative}
                    </span>

                    <span className="coord-status-cell">
                      {hasCoords && vehicle.telemetry ? (
                        `${vehicle.telemetry.latitude.toFixed(2)}°, ${vehicle.telemetry.longitude.toFixed(2)}°`
                      ) : hasLastKnown && vehicle.lastKnownLocation ? (
                        <span className="last-known-hint" title="Showing last known coordinates">
                          Last fix: {vehicle.lastKnownLocation.latitude.toFixed(2)}°, {vehicle.lastKnownLocation.longitude.toFixed(2)}°
                        </span>
                      ) : (
                        <span className="badge-no-location">
                          <MapPinOff size={11} /> No GPS Fix
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 5. Matrix Bottom Diagnostics Bar */}
        <div className="matrix-footer">
          <div className="health-pill">
            <span>Active Fixes: {vehicles.filter((v) => v.telemetry && isValidCoordinate(v.telemetry.latitude, v.telemetry.longitude)).length}/{vehicles.length}</span>
          </div>
          <div className="health-pill subtle">
            <Wifi size={12} /> {isLivePolling ? '10s Interval' : 'Manual Sync'}
          </div>
          <div className="health-pill subtle">
            <ShieldCheck size={12} /> Stale Units: {counts.STALE}
          </div>
        </div>
      </aside>

      {/* 6. Map Viewport Container */}
      <div className="tracking-map-panel">
        <MapViewport
          showFloatingTelemetryCard={!isDetailsOpen}
          visibleVehicleIds={filteredVehicles.map((vehicle) => vehicle.id)}
        />
      </div>

      {/* 7. Collapsible / Toggable Details Panel */}
      {isDetailsOpen && (
        <TrackingDetailsPanel
          vehicle={selectedVehicle}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
};
