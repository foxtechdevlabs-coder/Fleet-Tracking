import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Filter,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  User,
  Wifi,
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { hasValidCoordinates } from '../../types/telemetry';
import { MapViewport } from '../dashboard/MapViewport';
import { AddDeviceModal } from '../modals/AddDeviceModal';
import { TrackingDetailsPanel, formatTelemetryTime, getHeadingCompass } from './TrackingDetailsPanel';

const statusOptions = ['ALL', 'MOVING', 'STOPPED', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN'] as const;
type StatusFilter = (typeof statusOptions)[number];

export const LiveTrackingView: React.FC = () => {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, refreshTelemetry, isLoading, error } = useFleet();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
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

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const matchesStatus = statusFilter === 'ALL' || vehicle.operationalStatus === statusFilter;
      const searchableText = [vehicle.id, vehicle.plateNumber, vehicle.driverName ?? '', vehicle.make ?? '', vehicle.model ?? ''].join(' ').toLowerCase();
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter, vehicles]);

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? filteredVehicles[0] ?? vehicles[0] ?? null;

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
              title="Refresh Telemetry Stream"
              onClick={() => void refreshTelemetry()}
            >
              <RefreshCw size={15} />
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

            const labels: Record<StatusFilter, string> = {
              ALL: 'All',
              MOVING: 'Moving',
              STOPPED: 'Stopped',
              OFFLINE: 'Offline',
              MAINTENANCE: 'Maintenance',
              UNKNOWN: 'Unknown',
            };

            return (
              <button
                key={option}
                type="button"
                className={`status-tab ${statusFilter === option ? 'active' : ''}`}
                onClick={() => setStatusFilter(option)}
              >
                <span>{labels[option]}</span>
                <span className="tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="matrix-list">
          {isLoading ? (
            <div className="matrix-empty-state" role="status">
              <h3>Loading fleet snapshot</h3>
            </div>
          ) : error && vehicles.length === 0 ? (
            <div className="matrix-empty-state" role="alert">
              <h3>Fleet data unavailable</h3>
              <p>{error}</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="matrix-empty-state">
              <MapPinned size={28} color="#94a3b8" />
              <h3>{vehicles.length ? 'No matching assets' : 'No vehicles available'}</h3>
              <p>{vehicles.length ? 'Adjust the search or status filter to see other vehicles.' : 'No vehicles were returned by the fleet service.'}</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const isSelected = selectedVehicle?.id === vehicle.id;
              const isOffline = vehicle.operationalStatus === 'OFFLINE';
              const hasTelemetry = hasValidCoordinates(vehicle.telemetry?.latitude, vehicle.telemetry?.longitude);

              let operationalBadgeText = vehicle.operationalStatus === 'UNKNOWN' ? 'Status unavailable' : 'Offline';
              if (vehicle.operationalStatus === 'MOVING') {
                operationalBadgeText = `Moving ${Math.round(vehicle.telemetry?.speed ?? 0)} km/h`;
              } else if (vehicle.operationalStatus === 'STOPPED') {
                operationalBadgeText = 'Stopped 0 km/h';
              } else if (vehicle.operationalStatus === 'MAINTENANCE') {
                operationalBadgeText = 'Maintenance';
              }

              const headingInfo = getHeadingCompass(vehicle.telemetry?.heading);
              const headingDisplay = headingInfo.cardinal !== '—'
                ? `${headingInfo.degrees}° ${headingInfo.cardinal}`
                : '—';

              const timeFormatted = formatTelemetryTime(vehicle.telemetry?.recordedAt || vehicle.telemetry?.ingestedAt);
              const isSignalStale = hasTelemetry && timeFormatted.isStale;
              const lastPing = vehicle.telemetry?.recordedAt || vehicle.telemetry?.ingestedAt
                ? timeFormatted.relative
                : 'No Handshake';

              const corridor = hasTelemetry
                ? `Location: ${vehicle.telemetry!.latitude.toFixed(2)}°, ${vehicle.telemetry!.longitude.toFixed(2)}°`
                : 'Location Unavailable';

              const modelClass = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—';

              return (
                <button
                  key={vehicle.id}
                  id={`asset-card-${vehicle.id}`}
                  type="button"
                  className={`matrix-card ${isSelected ? 'selected' : ''} ${isOffline ? 'is-offline' : ''}`}
                  onClick={() => {
                    setSelectedVehicleId(vehicle.id);
                    setCenterTrigger((prev) => prev + 1);
                  }}
                >
                  <div className="matrix-card-header">
                    <div className="vehicle-mini-icon"><Truck size={14} /></div>
                    <div className="matrix-card-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="matrix-vehicle-id">{vehicle.id}</span>
                        {isSignalStale && <span className="signal-stale-tag">Signal Stale</span>}
                      </div>
                      <span className="matrix-plate">{vehicle.plateNumber}</span>
                    </div>
                    <span className={`matrix-speed ${vehicle.operationalStatus.toLowerCase()}`}>
                      {operationalBadgeText}
                    </span>
                  </div>

                  <div className="matrix-card-body">
                    <span className="matrix-model">{modelClass}</span>
                    <div className="matrix-metadata-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Compass size={11} color="#0284c7" />
                        <span>{headingDisplay}</span>
                      </span>
                      <span>
                        {hasTelemetry && vehicle.telemetry?.batteryVoltage !== undefined
                          ? `${vehicle.telemetry.batteryVoltage.toFixed(1)}V Aux`
                          : '—'}
                      </span>
                    </div>
                    <div className="matrix-driver-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} color="#64748b" />
                        <span>{vehicle.driverName || '—'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="matrix-card-footer">
                    <span>Ping: {lastPing}</span>
                    <span title="Location Corridor">{corridor}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="matrix-footer">
          <div className="health-pill">
            <span>Valid Locations: {vehicles.filter((vehicle) => hasValidCoordinates(vehicle.telemetry?.latitude, vehicle.telemetry?.longitude)).length}</span>
          </div>
          <div className="health-pill subtle">
            <Wifi size={12} /> Snapshot refresh
          </div>
          <div className="health-pill subtle">
            <ShieldCheck size={12} /> Status Reported {vehicles.filter((vehicle) => vehicle.operationalStatus !== 'UNKNOWN').length}
          </div>
        </div>
      </aside>

      <div className="tracking-map-panel">
        <MapViewport
          onAddDeviceClick={() => setIsAddModalOpen(true)}
          showFloatingTelemetryCard={!isDetailsOpen}
          centerTrigger={centerTrigger}
          onVehicleSelect={(id) => {
            setSelectedVehicleId(id);
          }}
        />
      </div>

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
