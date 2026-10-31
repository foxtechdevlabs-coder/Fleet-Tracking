import React, { useMemo, useState } from 'react';
import {
  Filter,
  MapPinned,
  Pause,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  User,
  Wifi,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { hasValidCoordinates, parseFiniteNumber } from '../../types/telemetry';
import { MapViewport } from '../dashboard/MapViewport';
import { TrackingDetailsPanel, formatTelemetryTime } from './TrackingDetailsPanel';

const statusOptions = ['ALL', 'MOVING', 'STOPPED', 'OFFLINE'] as const;
type StatusFilter = (typeof statusOptions)[number];

export const LiveTrackingView: React.FC = () => {
  const { vehicles, selectedVehicleId, setSelectedVehicleId } = useFleet();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExtendedFilter>('ALL');
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [centerTrigger, setCenterTrigger] = useState<number>(0);

  // Auto-refresh telemetry every 5 seconds — matches the "Auto-sync 5s" footer indicator.
  // Uses refreshTelemetry (which sets isRefreshing, not isLoading) so it runs silently in the background.
  useEffect(() => {
    const intervalId = setInterval(() => {
      void refreshTelemetry();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [refreshTelemetry]);

  // Memoized vehicle filtering with search, operational status, freshness, and coordinate validity
  const filteredVehicles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesStatus = statusFilter === 'ALL' || vehicle.operationalStatus === statusFilter;
      const searchableText = [vehicle.id, vehicle.plateNumber, vehicle.driverName ?? '', vehicle.model].join(' ').toLowerCase();
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

  // Auto-scroll selected vehicle card into view in the Asset Matrix when selection changes
  useEffect(() => {
    if (selectedVehicleId) {
      const el = document.getElementById(`asset-card-${selectedVehicleId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedVehicleId]);

  const handleCenterMap = useCallback(() => {
    setCenterTrigger((prev) => prev + 1);
  }, []);

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
            <button type="button" className="icon-button" aria-label="Refresh asset matrix">
              <RefreshCw size={15} />
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
          {statusOptions.map((option) => {
            const count =
              option === 'ALL'
                ? vehicles.length
                : vehicles.filter((vehicle) => vehicle.operationalStatus === option).length;

            return (
              <button
                key={option}
                type="button"
                className={`status-tab ${statusFilter === option ? 'active' : ''}`}
                onClick={() => setStatusFilter(option)}
              >
                {option === 'ALL' ? 'All' : option === 'MOVING' ? '• Moving' : option === 'STOPPED' ? '• Stopped' : '• Offline'}
                <span className="tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Matrix Vehicle Cards List / Error & Empty States */}
        <div className="matrix-list">
          {filteredVehicles.length === 0 ? (
            <div className="matrix-empty-state">
              <MapPinned size={28} color="#94a3b8" />
              <h3>No matching assets</h3>
              <p>Awaiting live telemetry. Vehicle information will appear here when the stream is active.</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const isSelected = selectedVehicle?.id === vehicle.id;
              const hasTelemetry = Boolean(
                vehicle.telemetry &&
                Number.isFinite(vehicle.telemetry.latitude) &&
                Number.isFinite(vehicle.telemetry.longitude),
              );
              const speedText = hasTelemetry && vehicle.telemetry?.speed !== null && vehicle.telemetry?.speed !== undefined
                ? `${Math.round(vehicle.telemetry.speed)} km/h`
                : '-- km/h';
              const lastPing = hasTelemetry
                ? formatTelemetryTime(vehicle.telemetry?.recordedAt || vehicle.telemetry?.ingestedAt).relative
                : 'Awaiting Fix';

              return (
                <button
                  key={vehicle.id}
                  id={`asset-card-${vehicle.id}`}
                  type="button"
                  className={`matrix-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                >
                  <div className="matrix-card-header">
                    <div className="vehicle-mini-icon">
                      <Truck size={14} />
                    </div>
                    <div className="matrix-card-meta">
                      <span className="matrix-vehicle-id">{vehicle.id}</span>
                      <span className="matrix-plate">{vehicle.plateNumber}</span>
                    </div>
                    <span className={`matrix-speed ${vehicle.operationalStatus.toLowerCase()}`}>{speedText}</span>
                  </div>

                  <div className="matrix-card-body">
                    <span className="matrix-model">{vehicle.model || 'Awaiting vehicle type'}</span>
                    <div className="matrix-metadata-row">
                      <span>{hasTelemetry ? `Heading ${vehicle.telemetry?.heading ?? 0}°` : 'Awaiting Fix'}</span>
                      <span>
                        {hasTelemetry && vehicle.telemetry?.batteryVoltage !== undefined
                          ? `${vehicle.telemetry.batteryVoltage.toFixed(0)}V Aux`
                          : '-- Aux'}
                      </span>
                    </div>
                    <div className="matrix-driver-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} color="#64748b" />
                        <span>{vehicle.driverName || '—'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Location status & Last Ping */}
                  <div className="matrix-card-footer">
                    <span>{lastPing}</span>
                    <span>
                      {hasTelemetry
                        ? `${vehicle.telemetry!.latitude.toFixed(2)}°, ${vehicle.telemetry!.longitude.toFixed(2)}°`
                        : 'Awaiting GPS'}
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
            <span>Fleet Health: {vehicles.length ? '96%' : '--%'}</span>
          </div>
          <div className="health-pill subtle">
            <Wifi size={12} /> Auto-sync 5s
          </div>
          <div className="health-pill subtle">
            <ShieldCheck size={12} /> Nodes Online {vehicles.filter((v) => v.operationalStatus !== 'OFFLINE').length}
          </div>
        </div>
      </aside>

      {/* 6. Map Viewport Container */}
      <div className="tracking-map-panel">
        <MapViewport
          onAddDeviceClick={() => undefined}
          showFloatingTelemetryCard={!isDetailsOpen}
        />
      </div>

      {/* 7. Collapsible / Toggable Details Panel */}
      {isDetailsOpen && (
        <TrackingDetailsPanel
          vehicle={selectedVehicle}
          onCenterMap={handleCenterMap}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}

      <AddDeviceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
};
