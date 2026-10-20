import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { hasValidCoordinates, type MapViewMode, type OperationalStatus } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';
import { getHeadingCompass, formatTelemetryTime } from '../tracking/TrackingDetailsPanel';

export interface MapViewportProps {
  onAddDeviceClick?: () => void;
  showFloatingTelemetryCard?: boolean;
  centerTrigger?: number;
  onVehicleSelect?: (vehicleId: string) => void;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

const getStatusColor = (status?: OperationalStatus) => {
  switch (status) {
    case 'MOVING':
      return '#10b981';
    case 'STOPPED':
      return '#f59e0b';
    case 'OFFLINE':
      return '#ef4444';
    case 'MAINTENANCE':
      return '#8b5cf6';
    case 'UNKNOWN':
      return '#64748b';
    default:
      return '#38bdf8';
  }
};

export const MapViewport: React.FC<MapViewportProps> = ({
  onAddDeviceClick,
  showFloatingTelemetryCard = true,
  centerTrigger,
  onVehicleSelect,
}) => {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, error, isLoading } = useFleet();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hasInitialFitBoundsRef = useRef<boolean>(false);
  const [mapMode, setMapMode] = useState<MapViewMode>('street');
  const [zoomLevel, setZoomLevel] = useState<number>(12);

  const activeVehicleIds = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          hasValidCoordinates(vehicle.telemetry?.latitude, vehicle.telemetry?.longitude),
      ),
    [vehicles],
  );

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0] ?? null;

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
    tileLayerRef.current = tiles;
    markerLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    return () => {
      markerLayerRef.current?.clearLayers();
      tileLayerRef.current?.remove();
      tileLayerRef.current = null;
      map.remove();
      leafletMapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  // Swap tile layer when the user toggles map mode
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const tileUrls: Record<MapViewMode, string> = {
      street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      traffic: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    };

    tileLayerRef.current?.remove();
    const newTile = L.tileLayer(tileUrls[mapMode], { maxZoom: 19, subdomains: ['a', 'b', 'c'] });
    newTile.addTo(map);
    tileLayerRef.current = newTile;
    // The map-init effect handles the first tile load; this runs only on subsequent mode changes.
  }, [mapMode]);

  // Auto-select the first vehicle once the vehicle list loads and nothing is selected yet.
  // Depend only on vehicles.length (not the full array reference) to avoid re-triggering
  // on every telemetry refresh that returns a new array object.
  useEffect(() => {
    if (!leafletMapRef.current) return;
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.length]);

  // Smoothly center/fly to target vehicle coordinates
  const flyToVehicle = useCallback((targetVehicleId?: string | null) => {
    const map = leafletMapRef.current;
    if (!map) return;
    const targetId = targetVehicleId || selectedVehicleId;
    const target = vehicles.find((v) => v.id === targetId);
    const telemetry = target?.telemetry;
    if (
      target && hasValidCoordinates(target.telemetry?.latitude, target.telemetry?.longitude)
    ) {
      map.flyTo([telemetry!.latitude, telemetry!.longitude], 15, {
        animate: true,
        duration: 1.2,
      });
      setZoomLevel(15);
    }
  }, [selectedVehicleId, vehicles]);

  const handleRecenter = useCallback(() => {
    const selected = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    if (selected && hasValidCoordinates(selected.telemetry?.latitude, selected.telemetry?.longitude)) {
      flyToVehicle(selected.id);
      return;
    }
    const map = leafletMapRef.current;
    if (!map) return;
    if (activeVehicleIds.length) {
      const bounds = L.latLngBounds(activeVehicleIds.map((vehicle) => [
        vehicle.telemetry!.latitude,
        vehicle.telemetry!.longitude,
      ] as [number, number]));
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
      return;
    }
    map.setView(DEFAULT_CENTER, 11);
  }, [activeVehicleIds, flyToVehicle, selectedVehicleId, vehicles]);

  const cycleMapMode = () => {
    setMapMode((mode) => mode === 'street' ? 'satellite' : mode === 'satellite' ? 'traffic' : 'street');
  };

  const toggleFullscreen = () => {
    const target = mapCanvasRef.current;
    if (!target) return;
    if (document.fullscreenElement === target) {
      void document.exitFullscreen();
    } else {
      void target.requestFullscreen();
    }
  };

  // Trigger flyTo when selectedVehicleId changes or when centerTrigger increments.
  // Guard with leafletMapRef.current so we don't try to fly before the map is mounted.
  useEffect(() => {
    if (selectedVehicleId && leafletMapRef.current) {
      flyToVehicle(selectedVehicleId);
    }
  }, [selectedVehicleId, centerTrigger, flyToVehicle]);

  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markerLayerRef.current;

    if (!map || !layer) {
      return;
    }

    layer.clearLayers();

    const validVehicles = vehicles.filter(
      (vehicle) =>
        hasValidCoordinates(vehicle.telemetry?.latitude, vehicle.telemetry?.longitude),
    );

    if (validVehicles.length === 0) {
      map.setView(DEFAULT_CENTER, 11);
      setZoomLevel(11);
      return;
    }

    // Only fitBounds on initial data arrival
    if (!hasInitialFitBoundsRef.current) {
      const points = validVehicles.map((vehicle) => [
        vehicle.telemetry!.latitude,
        vehicle.telemetry!.longitude,
      ] as [number, number]);

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
      setZoomLevel(map.getZoom());
      hasInitialFitBoundsRef.current = true;
    }

    validVehicles.forEach((vehicle) => {
      const speed = vehicle.telemetry?.speed ?? 0;
      const heading = vehicle.telemetry?.heading ?? 0;
      const isSelected = vehicle.id === selectedVehicleId;
      const telemetryTimestamp = vehicle.telemetry?.recordedAt || vehicle.telemetry?.ingestedAt;
      const locationTime = formatTelemetryTime(telemetryTimestamp);
      const isLocationStale = locationTime.isStale;

      let callout = `${vehicle.id} • ${vehicle.operationalStatus === 'UNKNOWN' ? 'Status unavailable' : 'Offline'}`;
      if (vehicle.operationalStatus === 'MOVING') {
        const compass = getHeadingCompass(heading);
        const headingPart = compass.cardinal !== '—' ? ` • ${compass.degrees}° ${compass.cardinal}` : '';
        callout = `${vehicle.id} • ${Math.round(speed)} km/h${headingPart}`;
      } else if (vehicle.operationalStatus === 'STOPPED') {
        callout = `${vehicle.id} • Idle (0 km/h)`;
      } else if (vehicle.operationalStatus === 'MAINTENANCE') {
        callout = `${vehicle.id} • Maintenance`;
      }
      if (isLocationStale) callout = `Stale location • ${callout}`;

      const icon = L.divIcon({
        className: `fleet-map-pin ${isSelected ? 'active-marker' : ''}`,
        html: `
          <span class="fleet-map-pin-core" style="background:${getStatusColor(vehicle.operationalStatus)}; ${isSelected ? 'transform: scale(1.3); box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.4);' : ''}"></span>
          <span class="fleet-map-pin-ring" style="border-color:${getStatusColor(vehicle.operationalStatus)}"></span>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        tooltipAnchor: [0, -16],
      });

      const marker = L.marker([vehicle.telemetry!.latitude, vehicle.telemetry!.longitude], {
        icon,
        opacity: isLocationStale ? 0.55 : 1,
      });
      marker.bindTooltip(callout, {
        permanent: false,
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
        className: 'fleet-map-callout',
      });

      marker.on('click', () => {
        setSelectedVehicleId(vehicle.id);
        onVehicleSelect?.(vehicle.id);
        map.flyTo([vehicle.telemetry!.latitude, vehicle.telemetry!.longitude], 15, {
          animate: true,
          duration: 1.0,
        });
      });
      marker.addTo(layer);

      // Only draw directional arrow marker if vehicle is active with valid heading
      if (vehicle.operationalStatus !== 'OFFLINE' && Number.isFinite(heading)) {
        const rotation = heading;
        const arrowIcon = L.divIcon({
          className: 'fleet-map-pin-arrow',
          html: `<span style="transform: rotate(${rotation}deg)"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2 L13 11 L8 9 L3 11 Z" fill="${getStatusColor(vehicle.operationalStatus)}"/></svg></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        L.marker([vehicle.telemetry!.latitude, vehicle.telemetry!.longitude], {
          icon: arrowIcon,
          interactive: false,
          opacity: isLocationStale ? 0.55 : 1,
        }).addTo(layer);
      }
    });
  }, [setSelectedVehicleId, vehicles, selectedVehicleId, onVehicleSelect]);

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
  const hasFreshTelemetry = activeVehicleIds.some((vehicle) => {
    const timestamp = vehicle.telemetry?.recordedAt || vehicle.telemetry?.ingestedAt;
    const time = formatTelemetryTime(timestamp);
    return Boolean(timestamp) && time.absolute !== '—' && !time.isStale;
  });
  const hasStaleTelemetry = activeVehicleIds.some((vehicle) =>
    formatTelemetryTime(vehicle.telemetry?.recordedAt || vehicle.telemetry?.ingestedAt).isStale,
  );
  let statusText: string;
  if (hasFreshTelemetry) {
    statusText = 'Telemetry snapshot available';
  } else if (hasStaleTelemetry) {
    statusText = 'Stale locations displayed';
  } else if (hasLiveTelemetry) {
    statusText = 'Location timestamps unavailable';
  } else if (error) {
    statusText = 'Snapshot API unavailable';
  } else if (isLoading) {
    statusText = 'Loading telemetry snapshot';
  } else {
    statusText = 'Awaiting valid GPS telemetry';
  }
  const latency = '--';
  const sync = error ? 'Snapshot API error' : isLoading ? 'Loading snapshot' : 'Backend snapshot';

  const displayedVehicle = selectedVehicle ?? vehicles[0] ?? null;
  const speedForDisplay = typeof displayedVehicle?.telemetry?.speed === 'number' && Number.isFinite(displayedVehicle.telemetry.speed) ? displayedVehicle.telemetry.speed : null;
  const headingForDisplay = typeof displayedVehicle?.telemetry?.heading === 'number' && Number.isFinite(displayedVehicle.telemetry.heading) ? displayedVehicle.telemetry.heading : null;
  const hasDisplayedLocation = hasValidCoordinates(displayedVehicle?.telemetry?.latitude, displayedVehicle?.telemetry?.longitude);
  const latForDisplay = hasDisplayedLocation ? displayedVehicle?.telemetry?.latitude ?? null : null;
  const lngForDisplay = hasDisplayedLocation ? displayedVehicle?.telemetry?.longitude ?? null : null;
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

          <button type="button" className="map-icon-btn" title="Recenter map" onClick={handleRecenter}>
            <Crosshair size={15} />
          </button>

          <button type="button" className="map-icon-btn" title="Cycle map layer" onClick={cycleMapMode}>
            <Layers size={15} />
          </button>
        </div>
      </div>

      <div ref={mapCanvasRef} className={`map-canvas-container ${mapMode}-mode map-viewport-shell`}>
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
          <button type="button" className="map-tool-btn" onClick={toggleFullscreen} aria-label="Fullscreen map">
            <Maximize2 size={15} />
          </button>
          <button type="button" className="map-tool-btn" onClick={handleRecenter} aria-label="Recenter map">
            <Crosshair size={15} />
          </button>
          <button type="button" className="map-tool-btn" onClick={cycleMapMode} aria-label="Cycle map layer">
            <Layers size={15} />
          </button>
        </div>

        <div className="map-compass-pill">
          <Compass size={14} />
          <span>HDG {headingForDisplay ?? '—'}{headingForDisplay === null ? '' : '°'} | Z{zoomLevel}</span>
        </div>

        <div ref={mapRef} className="leaflet-map-surface" aria-label="Fleet tracking map" />

        {!hasLiveTelemetry && (
          <div className="map-empty-overlay">
            <div className="map-empty-radar-icon">
              <Radio size={28} />
            </div>
            <h2 className="map-empty-title">{error ? 'Telemetry Snapshot Unavailable' : isLoading ? 'Loading Fleet Snapshot' : 'Awaiting GPS Telemetry'}</h2>
            <p className="map-empty-desc">
              {error ? 'The fleet API could not be reached. No vehicle locations are being shown.' : 'No valid vehicle coordinates are available. The map will center on the neutral corridor until a location is received.'}
            </p>
            {onAddDeviceClick && (
              <button type="button" className="btn-primary" onClick={onAddDeviceClick}>
                <Plus size={15} />
                <span>Add Vehicle Details</span>
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
                  {displayedVehicle.operationalStatus === 'UNKNOWN' ? 'Status unavailable' : displayedVehicle.operationalStatus}
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
                <small>{latForDisplay !== null && lngForDisplay !== null ? 'Location received' : 'Awaiting Fix'}</small>
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
                {typeof displayedVehicle.telemetry?.satelliteCount === 'number' && Number.isFinite(displayedVehicle.telemetry.satelliteCount) && (
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
        <div className="map-attribution">EPSG:3857 • WGS84 GPS Telemetry Feed • Refresh: 5s snapshot</div>
      </div>
    </div>
  );
};
