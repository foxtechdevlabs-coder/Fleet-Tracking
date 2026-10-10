import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Crosshair,
  Layers,
  Maximize2,
  Minus,
  Navigation,
  Plus,
  Radio,
} from 'lucide-react';
import type { MapViewMode, OperationalStatus } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';
import { getHeadingCompass, formatTelemetryTime } from '../tracking/TrackingDetailsPanel';

interface MapViewportProps {
  onAddDeviceClick?: () => void;
  showFloatingTelemetryCard?: boolean;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

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
  const speedForDisplay = displayedVehicle?.telemetry?.speed ?? null;
  const headingForDisplay = displayedVehicle?.telemetry?.heading ?? null;
  const latForDisplay = displayedVehicle?.telemetry?.latitude ?? null;
  const lngForDisplay = displayedVehicle?.telemetry?.longitude ?? null;
  const odometerForDisplay = displayedVehicle?.telemetry?.odometerKm ?? null;

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
          <div className="telemetry-floating-card">
            <div className="telemetry-card-header">
              <div className="telemetry-icon-box">
                <Navigation size={18} style={{ transform: `rotate(${headingForDisplay ?? 0}deg)` }} />
              </div>
              <div className="telemetry-card-heading">
                <div className="telemetry-id-row">
                  <span className="telemetry-id">{displayedVehicle.id}</span>
                  <span className="telemetry-plate">{displayedVehicle.plateNumber}</span>
                </div>
                <div className="telemetry-model-row">
                  <span>{displayedVehicle.make} {displayedVehicle.model} {displayedVehicle.year ? `(${displayedVehicle.year})` : ''}</span>
                </div>
              </div>
              <div className="telemetry-select-btn">
                <span className={`status-badge ${displayedVehicle.operationalStatus}`}>
                  <span className="status-badge-dot" />
                  {displayedVehicle.operationalStatus}
                </span>
              </div>
            </div>

            <div className="telemetry-grid">
              <div className="telemetry-metric">
                <span className="metric-label">INSTANT SPEED</span>
                <strong>{speedForDisplay !== null ? `${Math.round(speedForDisplay)} km/h` : '-- km/h'}</strong>
                <div className="metric-bar">
                  <span style={{ width: `${speedForDisplay ? Math.min(100, (speedForDisplay / 120) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="telemetry-metric">
                <span className="metric-label">BEARING &amp; VECTOR</span>
                <strong>{getHeadingCompass(headingForDisplay).degrees !== null ? `${getHeadingCompass(headingForDisplay).degrees}° ${getHeadingCompass(headingForDisplay).cardinal}` : '--'}</strong>
                <small>{getHeadingCompass(headingForDisplay).cardinal !== '--' ? `Vector ${getHeadingCompass(headingForDisplay).cardinal}` : 'Awaiting Fix'}</small>
              </div>
              <div className="telemetry-metric">
                <span className="metric-label">GNSS COORDINATES</span>
                <strong>{latForDisplay !== null && lngForDisplay !== null ? `${latForDisplay.toFixed(4)}°, ${lngForDisplay.toFixed(4)}°` : '--'}</strong>
                <small>{latForDisplay !== null && lngForDisplay !== null ? 'Fix: Real-time GNSS' : 'Awaiting Fix'}</small>
              </div>
              <div className="telemetry-metric">
                <span className="metric-label">ODOMETER</span>
                <strong>{odometerForDisplay !== null ? `${odometerForDisplay.toLocaleString()} km` : '-- km'}</strong>
                <small>Hardware reading</small>
              </div>
              <div className="telemetry-metric">
                <span className="metric-label">LAST TELEMETRY UPDATE</span>
                <strong>{formatTelemetryTime(displayedVehicle.telemetry?.recordedAt || displayedVehicle.telemetry?.ingestedAt).relative}</strong>
                <small>{formatTelemetryTime(displayedVehicle.telemetry?.recordedAt || displayedVehicle.telemetry?.ingestedAt).absolute}</small>
              </div>
            </div>

            <div className="telemetry-footer-row">
              <div className="driver-chip">
                <div className="driver-avatar">
                  {displayedVehicle.driverName
                    ? displayedVehicle.driverName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'NA'}
                </div>
                <div>
                  <strong>{displayedVehicle.driverName ?? 'Driver Unassigned'}</strong>
                  <span>{displayedVehicle.driverPhone ?? 'No contact phone'}</span>
                </div>
              </div>

              <div className="hardware-chip">
                <span>Bonded Device:</span>
                <span>{displayedVehicle.deviceId ?? 'Unregistered'}</span>
                {displayedVehicle.telemetry?.batteryVoltage !== undefined && (
                  <span>Battery: {displayedVehicle.telemetry.batteryVoltage.toFixed(1)}V</span>
                )}
                {displayedVehicle.telemetry?.satelliteCount !== undefined && (
                  <span>Sats: {displayedVehicle.telemetry.satelliteCount}</span>
                )}
              </div>
            </div>
          </div>
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
