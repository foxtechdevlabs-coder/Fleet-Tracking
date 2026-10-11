import React, { useMemo, useState } from 'react';
import {
  Filter,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Wifi,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { MapViewport } from '../dashboard/MapViewport';
import { TrackingDetailsPanel, formatTelemetryTime } from './TrackingDetailsPanel';

const statusOptions = ['ALL', 'MOVING', 'STOPPED', 'OFFLINE'] as const;
type StatusFilter = (typeof statusOptions)[number];

export const LiveTrackingView: React.FC = () => {
  const {
    vehicles,
    isLoading,
    isRefreshing,
    error,
    refreshTelemetry,
    selectedVehicleId,
    setSelectedVehicleId,
  } = useFleet();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesStatus = statusFilter === 'ALL' || vehicle.operationalStatus === statusFilter;
      const searchableText = [vehicle.id, vehicle.plateNumber, vehicle.driverName ?? '', vehicle.model].join(' ').toLowerCase();
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter, vehicles]);

  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? filteredVehicles[0] ?? null;

  React.useEffect(() => {
    if (filteredVehicles.length > 0 && !filteredVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(filteredVehicles[0].id);
    }
  }, [filteredVehicles, selectedVehicleId, setSelectedVehicleId]);

  return (
    <div className={`live-tracking-shell ${isDetailsOpen ? 'with-details' : ''}`}>
      <aside className="asset-matrix-panel">
        <div className="matrix-panel-header">
          <div className="matrix-title-group">
            <h2>Live Asset Matrix</h2>
            <span className="pill-counter">{vehicles.length || 0} Units</span>
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
              disabled={isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            </button>
          </div>
        </div>

        <div className="matrix-toolbar">
          <label className="search-input-box matrix-search-box" aria-label="Filter vehicles">
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              value={searchQuery}
              placeholder="Filter by Vehicle ID, Reg, Driver..."
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <button type="button" className="icon-button" aria-label="Open filter settings">
            <Filter size={15} />
          </button>
        </div>

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

        <div className="matrix-list">
          {isLoading && vehicles.length === 0 ? (
            <div className="matrix-empty-state" role="status">
              <RefreshCw size={24} className="spin-anim" />
              <h3>Loading fleet data</h3>
              <p>Retrieving registered vehicle records from the FleetTrack API.</p>
            </div>
          ) : error && vehicles.length === 0 ? (
            <div className="matrix-empty-state" role="alert">
              <MapPinned size={28} color="#94a3b8" />
              <h3>Fleet data unavailable</h3>
              <p>{error}</p>
              <button type="button" className="btn-secondary" onClick={() => void refreshTelemetry()} disabled={isRefreshing}>
                Retry
              </button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="matrix-empty-state">
              <MapPinned size={28} color="#94a3b8" />
              <h3>No registered vehicles</h3>
              <p>The FleetTrack API returned no vehicle records.</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="matrix-empty-state">
              <MapPinned size={28} color="#94a3b8" />
              <h3>No matching assets</h3>
              <p>Try changing the search text or status filter.</p>
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
                  type="button"
                  className={`matrix-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                >
                  <div className="matrix-card-header">
                    <div className="vehicle-mini-icon"><Truck size={14} /></div>
                    <div className="matrix-card-meta">
                      <span className="matrix-vehicle-id">{vehicle.id}</span>
                      <span className="matrix-plate">{vehicle.plateNumber}</span>
                    </div>
                    <span className={`matrix-speed ${vehicle.operationalStatus.toLowerCase()}`}>{speedText}</span>
                  </div>

                  <div className="matrix-card-body">
                    <span className="matrix-model">{vehicle.model || 'Awaiting vehicle type'}</span>
                    <div className="matrix-metadata-row">
                      <span>{vehicle.telemetry?.heading !== undefined ? `Heading ${vehicle.telemetry.heading}°` : 'Heading unavailable'}</span>
                      <span>
                        {hasTelemetry && vehicle.telemetry?.batteryVoltage !== undefined
                          ? `${vehicle.telemetry.batteryVoltage.toFixed(0)}V Aux`
                          : '-- Aux'}
                      </span>
                    </div>
                    <div className="matrix-driver-row">
                      <span>{vehicle.driverName ?? 'Driver Unassigned'}</span>
                    </div>
                  </div>

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

        <div className="matrix-footer">
          <div className="health-pill">
            <span>Fleet Health: --</span>
          </div>
          <div className="health-pill subtle">
            <Wifi size={12} /> Manual refresh
          </div>
          <div className="health-pill subtle">
            <ShieldCheck size={12} /> Status unknown {vehicles.filter((v) => v.operationalStatus === 'UNKNOWN').length}
          </div>
        </div>
      </aside>

      <div className="tracking-map-panel">
        <MapViewport
          showFloatingTelemetryCard={!isDetailsOpen}
          visibleVehicleIds={filteredVehicles.map((vehicle) => vehicle.id)}
        />
      </div>

      {isDetailsOpen && (
        <TrackingDetailsPanel
          vehicle={selectedVehicle}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
};
