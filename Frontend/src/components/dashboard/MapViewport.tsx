import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Cpu,
  Crosshair,
  Layers,
  Maximize2,
  Minus,
  Play,
  Plus,
  Radio,
  Satellite,
  ShieldCheck,
  Signal,
  Truck,
} from 'lucide-react';
import type { MapViewMode, OperationalStatus, Vehicle } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';
import { getHeadingCompass, formatTelemetryTime } from '../tracking/TrackingDetailsPanel';

interface MapViewportProps {
  onAddDeviceClick?: () => void;
  showFloatingTelemetryCard?: boolean;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

// ─── Floating HUD Card ──────────────────────────────────────────────────────
interface FloatingHudCardProps {
  vehicle: Vehicle;
  onCenterMap: () => void;
}

const getHudStatusLabel = (status?: OperationalStatus): string => {
  switch (status) {
    case 'MOVING':      return 'Active Transit';
    case 'STOPPED':     return 'Stopped';
    case 'MAINTENANCE': return 'Maintenance';
    case 'OFFLINE':
    default:            return 'Offline';
  }
};

const FloatingHudCard: React.FC<FloatingHudCardProps> = ({ vehicle, onCenterMap }) => {
  const telemetry = vehicle.telemetry;
  const headingInfo = getHeadingCompass(telemetry?.heading);
  const timeInfo = formatTelemetryTime(telemetry?.recordedAt || telemetry?.ingestedAt);
  const speed = telemetry?.speed ?? null;
  const lat = telemetry?.latitude ?? null;
  const lng = telemetry?.longitude ?? null;

  const speedPct = speed !== null ? Math.min(100, (speed / 120) * 100) : 0;
  const latDisplay = lat !== null && Number.isFinite(lat)
    ? `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
    : 'Awaiting GPS Fix';
  const lngDisplay = lng !== null && Number.isFinite(lng)
    ? `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`
    : 'Awaiting GPS Fix';
  const hasCoords = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const satCount = telemetry?.satelliteCount ?? 0;

  const driverInitials = vehicle.driverName
    ? vehicle.driverName.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
    : 'NA';

  const statusLabel = getHudStatusLabel(vehicle.operationalStatus);
  const os = vehicle.operationalStatus as OperationalStatus | undefined;

  return (
    <div className="hud-floating-card">
      {/* ── Header Row ───────────────────────────────────────── */}
      <div className="hud-header-row">
        <div className="hud-vehicle-icon">
          <Truck size={18} />
        </div>

        <div className="hud-identity">
          <div className="hud-id-row">
            <span className="hud-vehicle-id">{vehicle.id}</span>
            <span className="hud-plate-badge">{vehicle.plateNumber}</span>
            <span className="hud-make-badge">{vehicle.make} {vehicle.model}</span>
          </div>
          <div className="hud-subline">
            <span className="hud-fleet-status">
              <ShieldCheck size={11} />
              Fleet Active
            </span>
            <span className="hud-device-label">
              <Cpu size={11} />
              {vehicle.deviceId ? `Device ID: ${vehicle.deviceId}` : 'Device: Unregistered'}
            </span>
          </div>
        </div>

        <span className={`hud-op-badge hud-op-badge--${(os ?? 'OFFLINE').toLowerCase()}`}>
          <span className="hud-op-dot" />
          {statusLabel}
        </span>
      </div>

      {/* ── 5-Metric Telemetry Grid ──────────────────────────── */}
      <div className="hud-metrics-grid">
        {/* 1. Instant Speed */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">INSTANT SPEED</span>
          <strong className="hud-metric-value">
            {speed !== null ? `${Math.round(speed)} km/h` : '-- km/h'}
          </strong>
          <div className="hud-speed-track" aria-label="Speed gauge">
            <div className="hud-speed-fill" style={{ width: `${speedPct}%` }} />
          </div>
          <span className="hud-metric-sub">
            {speed !== null && speed > 0 ? 'In Transit' : 'Stationary'}
          </span>
        </div>

        {/* 2. Bearing & Vector */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">BEARING &amp; VECTOR</span>
          <strong className="hud-metric-value">
            {headingInfo.degrees !== null ? `${headingInfo.degrees}°` : '--'}
            {headingInfo.cardinal !== '--' && (
              <span className="hud-cardinal-tag"> {headingInfo.cardinal}</span>
            )}
          </strong>
          <span className="hud-metric-sub">
            {headingInfo.degrees !== null
              ? `${headingInfo.degrees}° ${headingInfo.cardinalName}`
              : 'Awaiting bearing fix'}
          </span>
        </div>

        {/* 3. GNSS Coordinates */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">GNSS COORDINATES</span>
          <strong className="hud-metric-value hud-coords-stacked">
            <span>{latDisplay}</span>
            <span>{lngDisplay}</span>
          </strong>
          <span className="hud-metric-sub">
            <Satellite size={10} />
            {hasCoords ? `Fix: ${satCount} Sats in view` : 'Awaiting satellite fix'}
          </span>
        </div>

        {/* 4. Odometer & Run */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">ODOMETER &amp; RUN</span>
          <strong className="hud-metric-value">
            {telemetry?.odometerKm !== undefined
              ? `${telemetry.odometerKm.toLocaleString()} KM`
              : '-- KM'}
          </strong>
          <span className="hud-metric-sub">
            {telemetry?.fuelPercentage !== undefined
              ? `Fuel: ${Math.round(telemetry.fuelPercentage)}%`
              : telemetry?.batteryVoltage !== undefined
              ? `Aux: ${telemetry.batteryVoltage.toFixed(1)}V`
              : 'Fuel: --'}
          </span>
        </div>

        {/* 5. Cellular & Telemetry Ping */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">CELLULAR &amp; PING</span>
          <strong className="hud-metric-value">
            <Signal size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            {timeInfo.relative}
          </strong>
          <span className="hud-metric-sub">
            {timeInfo.absolute !== '--' ? timeInfo.absolute : 'Awaiting first ping'}
          </span>
        </div>
      </div>

      {/* ── Bottom Row: Driver / Hardware / Actions ──────────── */}
      <div className="hud-bottom-row">
        {/* Driver */}
        <div className="hud-driver-section">
          <div className="hud-driver-avatar">{driverInitials}</div>
          <div className="hud-driver-info">
            <span className="hud-driver-name">{vehicle.driverName ?? 'Driver Unassigned'}</span>
            {vehicle.driverPhone ? (
              <a href={`tel:${vehicle.driverPhone}`} className="hud-driver-phone">
                {vehicle.driverPhone}
              </a>
            ) : (
              <span className="hud-no-phone">No phone on record</span>
            )}
          </div>
        </div>

        {/* Hardware Node */}
        <div className="hud-hardware-section">
          <span className="hud-hw-label">
            <Cpu size={11} />
            Hardware Node
          </span>
          <span className="hud-hw-value">
            {vehicle.deviceId ?? 'Unregistered'}
          </span>
          <span className="hud-hw-aux">
            {telemetry?.batteryVoltage !== undefined
              ? `Aux: ${telemetry.batteryVoltage.toFixed(1)}V`
              : 'Aux: --'}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="hud-actions">
          <button type="button" className="hud-action-btn" title="Send Ping">
            📡 Send Ping
          </button>
          <button type="button" className="hud-action-btn" title="Center map on vehicle" onClick={onCenterMap}>
            🎯 Center Map
          </button>
          <button type="button" className="hud-action-btn" title="View vehicle specs">
            ⚙ Specs
          </button>
          <button type="button" className="hud-action-btn hud-action-btn--primary" title="Play route back">
            <Play size={11} />
            Playback Route
          </button>
        </div>
      </div>
    </div>
  );
};

const getStatusColor = (status?: OperationalStatus) => {
  switch (status) {
    case 'MOVING':
      return '#10b981';
    case 'STOPPED':
      return '#f59e0b';
    case 'OFFLINE':
      return '#64748b';
    case 'MAINTENANCE':
      return '#8b5cf6';
    default:
      return '#38bdf8';
  }
};

export const MapViewport: React.FC<MapViewportProps> = ({
  onAddDeviceClick,
  showFloatingTelemetryCard = true,
}) => {
  const { vehicles, selectedVehicleId, setSelectedVehicleId } = useFleet();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapMode, setMapMode] = useState<MapViewMode>('street');
  const [zoomLevel, setZoomLevel] = useState<number>(12);

  const activeVehicleIds = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.telemetry &&
          Number.isFinite(vehicle.telemetry.latitude) &&
          Number.isFinite(vehicle.telemetry.longitude),
      ),
    [vehicles],
  );

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? activeVehicleIds[0] ?? null;

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) {
      return;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView(DEFAULT_CENTER, 11);

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    });

    tiles.addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    return () => {
      markerLayerRef.current?.clearLayers();
      map.remove();
      leafletMapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current) {
      return;
    }

    if (!selectedVehicleId && vehicles[0]) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [selectedVehicleId, setSelectedVehicleId, vehicles]);

  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markerLayerRef.current;

    if (!map || !layer) {
      return;
    }

    layer.clearLayers();

    const validVehicles = vehicles.filter(
      (vehicle) =>
        vehicle.telemetry &&
        Number.isFinite(vehicle.telemetry.latitude) &&
        Number.isFinite(vehicle.telemetry.longitude),
    );

    if (validVehicles.length === 0) {
      map.setView(DEFAULT_CENTER, 11);
      setZoomLevel(11);
      return;
    }

    const points = validVehicles.map((vehicle) => [
      vehicle.telemetry!.latitude,
      vehicle.telemetry!.longitude,
    ] as [number, number]);

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
    setZoomLevel(map.getZoom());

    validVehicles.forEach((vehicle) => {
      const speed = vehicle.telemetry?.speed ?? 0;
      const heading = vehicle.telemetry?.heading ?? 0;
      const icon = L.divIcon({
        className: 'fleet-map-pin',
        html: `
          <span class="fleet-map-pin-core" style="background:${getStatusColor(vehicle.operationalStatus)}"></span>
          <span class="fleet-map-pin-ring" style="border-color:${getStatusColor(vehicle.operationalStatus)}"></span>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        tooltipAnchor: [0, -20],
      });

      const marker = L.marker([vehicle.telemetry!.latitude, vehicle.telemetry!.longitude], { icon });
      marker.bindTooltip(`${vehicle.id} • ${speed} km/h`, {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
      });
      marker.on('click', () => {
        setSelectedVehicleId(vehicle.id);
      });
      marker.addTo(layer);

      const rotation = Number.isFinite(heading) ? heading : 0;
      const arrowIcon = L.divIcon({
        className: 'fleet-map-pin-arrow',
        html: `<span style="transform: rotate(${rotation}deg)"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2 L13 11 L8 9 L3 11 Z" fill="${getStatusColor(vehicle.operationalStatus)}"/></svg></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker([vehicle.telemetry!.latitude, vehicle.telemetry!.longitude], {
        icon: arrowIcon,
        interactive: false,
      }).addTo(layer);
    });
  }, [setSelectedVehicleId, vehicles]);

  const handleZoom = (direction: 'in' | 'out') => {
    const map = leafletMapRef.current;
    if (!map) {
      return;
    }

    if (direction === 'in') {
      map.setZoom(map.getZoom() + 1);
    } else {
      map.setZoom(map.getZoom() - 1);
    }
    setZoomLevel(map.getZoom());
  };

  const hasLiveTelemetry = activeVehicleIds.length > 0;
  const statusText = hasLiveTelemetry ? 'Socket.IO Connected' : 'Awaiting Live GPS Telemetry Stream';
  const latency = hasLiveTelemetry ? '34ms' : '--';
  const sync = hasLiveTelemetry ? 'Update: 5s sync' : 'Awaiting Fix';

  const displayedVehicle = selectedVehicle ?? vehicles[0] ?? null;
  const headingForDisplay = displayedVehicle?.telemetry?.heading ?? null;

  return (
    <div className="map-card">
      <div className="map-card-header">
        <div className="map-card-title">
          <Radio size={16} color="#0284c7" />
          <span>Live Fleet Deployment Map Overview</span>
          {activeVehicleIds.length > 0 && (
            <span className="badge-count stream">{activeVehicleIds.length} Active Nodes</span>
          )}
        </div>

        <div className="map-card-controls">
          <div className="map-mode-toggle" role="group" aria-label="Map style selector">
            <button
              type="button"
              className={`map-mode-btn ${mapMode === 'street' ? 'active' : ''}`}
              onClick={() => setMapMode('street')}
            >
              Roadway View
            </button>
            <button
              type="button"
              className={`map-mode-btn ${mapMode === 'satellite' ? 'active' : ''}`}
              onClick={() => setMapMode('satellite')}
            >
              Terrain Density
            </button>
            <button
              type="button"
              className={`map-mode-btn ${mapMode === 'traffic' ? 'active' : ''}`}
              onClick={() => setMapMode('traffic')}
            >
              Speed Heatmap
            </button>
          </div>

          <button type="button" className="map-icon-btn" title="Recenter on fleet" onClick={() => { if (vehicles[0]) setSelectedVehicleId(vehicles[0].id); }}>
            <Crosshair size={15} />
          </button>

          <button type="button" className="map-icon-btn" title="Toggle layers and overlays">
            <Layers size={15} />
          </button>
        </div>
      </div>

      <div className={`map-canvas-container ${mapMode}-mode map-viewport-shell`}>
        <div className="radar-sweep" />

        <div className="map-top-hud">
          <span className="map-hud-pill map-hud-live">{statusText}</span>
          <span className="map-hud-pill">Latency: {latency}</span>
          <span className="map-hud-pill">{sync}</span>
        </div>

        <div className="map-floating-tools" aria-label="Map actions">
          <button type="button" className="map-tool-btn" onClick={() => handleZoom('in')} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" className="map-tool-btn" onClick={() => handleZoom('out')} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" className="map-tool-btn" aria-label="Fullscreen map">
            <Maximize2 size={15} />
          </button>
          <button type="button" className="map-tool-btn" aria-label="Recenter map">
            <Crosshair size={15} />
          </button>
          <button type="button" className="map-tool-btn" aria-label="Layers">
            <Layers size={15} />
          </button>
        </div>

        <div className="map-compass-pill">
          <Compass size={14} />
          <span>HDG {headingForDisplay ?? 0}° | Z{zoomLevel}</span>
        </div>

        <div ref={mapRef} className="leaflet-map-surface" aria-label="Fleet tracking map" />

        {!hasLiveTelemetry && (
          <div className="map-empty-overlay">
            <div className="map-empty-radar-icon">
              <Radio size={28} />
            </div>
            <h2 className="map-empty-title">Awaiting Live GPS Telemetry Stream</h2>
            <p className="map-empty-desc">
              No live vehicle coordinates have been received yet. The map will center on the neutral corridor until telemetry becomes available.
            </p>
            {onAddDeviceClick && (
              <button type="button" className="btn-primary" onClick={onAddDeviceClick}>
                <Plus size={15} />
                <span>Connect Device &amp; Vehicle</span>
              </button>
            )}
          </div>
        )}

        {showFloatingTelemetryCard && displayedVehicle && (
          <FloatingHudCard
            vehicle={displayedVehicle}
            onCenterMap={() => {
              const map = leafletMapRef.current;
              const t = displayedVehicle.telemetry;
              if (map && t && Number.isFinite(t.latitude) && Number.isFinite(t.longitude)) {
                map.setView([t.latitude, t.longitude], 15, { animate: true });
              }
            }}
          />
        )}
      </div>

      <div className="map-card-footer">
        <div className="map-legend">
          <div className="legend-item"><span className="legend-dot moving" />Moving</div>
          <div className="legend-item"><span className="legend-dot stopped" />Stopped</div>
          <div className="legend-item"><span className="legend-dot offline" />Offline</div>
        </div>
        <div className="map-attribution">EPSG:3857 • WGS84 GPS Telemetry Feed • Refresh: 1000ms</div>
      </div>
    </div>
  );
};
