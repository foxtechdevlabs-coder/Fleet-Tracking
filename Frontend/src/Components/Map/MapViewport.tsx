import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
import './MapViewport.css';
import type { LatestLocation, TrackingStatus } from '../../types/fleet';
import { formatTelemetryTime, getHeadingCompass, hasValidCoordinates, parseFiniteNumber } from '../../utils/telemetry';

export interface MapViewportProps {
  locations: LatestLocation[];
  isLoading?: boolean;
  error?: string;
}

type MapViewMode = 'street' | 'satellite' | 'traffic';

const WORLD_OVERVIEW_CENTER: [number, number] = [0, 0];
const WORLD_OVERVIEW_ZOOM = 2;

const TILE_URLS: Record<MapViewMode, string> = {
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  traffic: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
};

const STATUS_LABELS: Record<TrackingStatus, string> = {
  moving: 'Moving',
  idle: 'Idle',
  stale: 'Stale',
  offline: 'Offline',
};

// Reuses the badge colour classes from the original stylesheet.
const STATUS_BADGE_CLASS: Record<TrackingStatus, string> = {
  moving: 'MOVING',
  idle: 'STOPPED',
  stale: 'MAINTENANCE',
  offline: 'OFFLINE',
};

function getCoordinates(location: LatestLocation): [number, number] | null {
  const latitude = parseFiniteNumber(location.latitude);
  const longitude = parseFiniteNumber(location.longitude);
  return latitude !== null && longitude !== null && hasValidCoordinates(latitude, longitude)
    ? [latitude, longitude]
    : null;
}

function getStatusColor(status?: TrackingStatus): string {
  switch (status) {
    case 'moving':
      return '#10b981';
    case 'idle':
      return '#f59e0b';
    case 'stale':
      return '#8b5cf6';
    case 'offline':
      return '#ef4444';
    default:
      return '#38bdf8';
  }
}

function isLocationStale(location: LatestLocation): boolean {
  if (location.status) return location.status === 'stale' || location.status === 'offline';
  return formatTelemetryTime(location.recordedAt).isStale;
}

function buildCallout(location: LatestLocation): HTMLElement {
  const speed = parseFiniteNumber(location.speed);
  const compass = getHeadingCompass(location.heading);
  const parts = [location.vehicleId.slice(0, 8)];
  if (location.status) parts.push(STATUS_LABELS[location.status]);
  if (speed !== null) parts.push(`${Math.round(speed)} km/h`);
  if (compass.degrees !== null) parts.push(`${compass.degrees}° ${compass.cardinal}`);

  // Leaflet inserts string tooltips as HTML, so pass a text-only element instead.
  const element = document.createElement('span');
  element.textContent = parts.join(' • ');
  return element;
}

export function MapViewport({ locations, isLoading = false, error = '' }: MapViewportProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const hasInitialFitBoundsRef = useRef(false);
  const [mapMode, setMapMode] = useState<MapViewMode>('street');
  const [zoomLevel, setZoomLevel] = useState(WORLD_OVERVIEW_ZOOM);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const mappedLocations = useMemo(
    () => locations.filter((location) => getCoordinates(location) !== null),
    [locations],
  );

  const selectedLocation =
    mappedLocations.find((location) => location.vehicleId === selectedVehicleId) ?? mappedLocations[0] ?? null;

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) {
      return;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView(WORLD_OVERVIEW_CENTER, WORLD_OVERVIEW_ZOOM);

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

  // Swap the tile layer when the user toggles map mode.
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    tileLayerRef.current?.remove();
    const tiles = L.tileLayer(TILE_URLS[mapMode], { maxZoom: 19, subdomains: ['a', 'b', 'c'] });
    tiles.addTo(map);
    tileLayerRef.current = tiles;
  }, [mapMode]);

  const flyToLocation = useCallback((location: LatestLocation) => {
    const map = leafletMapRef.current;
    const coordinates = getCoordinates(location);
    if (!map || !coordinates) return;
    map.flyTo(coordinates, 15, { animate: true, duration: 1.2 });
    setZoomLevel(15);
  }, []);

  const handleRecenter = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const selected = mappedLocations.find((location) => location.vehicleId === selectedVehicleId);
    if (selected) {
      flyToLocation(selected);
      return;
    }
    if (mappedLocations.length) {
      const bounds = L.latLngBounds(mappedLocations.flatMap((location) => {
        const coordinates = getCoordinates(location);
        return coordinates ? [coordinates] : [];
      }));
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
      return;
    }
    map.setView(WORLD_OVERVIEW_CENTER, WORLD_OVERVIEW_ZOOM);
  }, [mappedLocations, flyToLocation, selectedVehicleId]);

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

  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) {
      return;
    }

    layer.clearLayers();

    if (mappedLocations.length === 0) {
      map.setView(WORLD_OVERVIEW_CENTER, WORLD_OVERVIEW_ZOOM);
      setZoomLevel(WORLD_OVERVIEW_ZOOM);
      hasInitialFitBoundsRef.current = false;
      return;
    }

    // Only fit bounds when locations first arrive, so refreshes keep the user's view.
    if (!hasInitialFitBoundsRef.current) {
      const bounds = L.latLngBounds(mappedLocations.flatMap((location) => {
        const coordinates = getCoordinates(location);
        return coordinates ? [coordinates] : [];
      }));
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
      setZoomLevel(map.getZoom());
      hasInitialFitBoundsRef.current = true;
    }

    mappedLocations.forEach((location) => {
      const coordinates = getCoordinates(location);
      if (!coordinates) return;

      const heading = parseFiniteNumber(location.heading);
      const isSelected = location.vehicleId === selectedLocation?.vehicleId;
      const opacity = isLocationStale(location) ? 0.55 : 1;
      const color = getStatusColor(location.status);

      const icon = L.divIcon({
        className: `fleet-map-pin ${isSelected ? 'active-marker' : ''}`,
        html: `
          <span class="fleet-map-pin-core" style="background:${color}; ${isSelected ? 'transform: scale(1.3); box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.4);' : ''}"></span>
          <span class="fleet-map-pin-ring" style="border-color:${color}"></span>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        tooltipAnchor: [0, -16],
      });

      const marker = L.marker(coordinates, { icon, opacity });
      marker.bindTooltip(buildCallout(location), {
        permanent: false,
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
        className: 'fleet-map-callout',
      });
      marker.on('click', () => {
        setSelectedVehicleId(location.vehicleId);
        flyToLocation(location);
      });
      marker.addTo(layer);

      // Draw a direction arrow only for vehicles that are not offline and report a heading.
      if (location.status !== 'offline' && heading !== null) {
        const arrowIcon = L.divIcon({
          className: 'fleet-map-pin-arrow',
          html: `<span style="transform: rotate(${heading}deg)"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2 L13 11 L8 9 L3 11 Z" fill="${color}"/></svg></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker(coordinates, { icon: arrowIcon, interactive: false, opacity }).addTo(layer);
      }
    });
  }, [mappedLocations, selectedLocation?.vehicleId, flyToLocation]);

  const handleZoom = (direction: 'in' | 'out') => {
    const map = leafletMapRef.current;
    if (!map) {
      return;
    }
    map.setZoom(map.getZoom() + (direction === 'in' ? 1 : -1));
    setZoomLevel(map.getZoom());
  };

  const hasLocations = mappedLocations.length > 0;
  const hasFreshLocations = mappedLocations.some((location) => !isLocationStale(location));
  let statusText: string;
  if (hasFreshLocations) {
    statusText = 'Telemetry snapshot available';
  } else if (hasLocations) {
    statusText = 'Stale locations displayed';
  } else if (error) {
    statusText = 'Snapshot API unavailable';
  } else if (isLoading) {
    statusText = 'Loading telemetry snapshot';
  } else {
    statusText = 'Awaiting valid GPS telemetry';
  }
  const sync = error ? 'Snapshot API error' : isLoading ? 'Loading snapshot' : 'Backend snapshot';

  const speedForDisplay = selectedLocation ? parseFiniteNumber(selectedLocation.speed) : null;
  const compass = getHeadingCompass(selectedLocation?.heading);
  const selectedCoordinates = selectedLocation ? getCoordinates(selectedLocation) : null;
  const lastUpdate = formatTelemetryTime(selectedLocation?.recordedAt);

  return (
    <div className="live-map-viewport">
      <div className="map-card">
        <div className="map-card-header">
          <div className="map-card-title">
            <Radio size={16} color="#0284c7" />
            <span>Live Fleet Map</span>
            {hasLocations && (
              <span className="badge-count stream">{mappedLocations.length} on map</span>
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
                Satellite
              </button>
              <button
                type="button"
                className={`map-mode-btn ${mapMode === 'traffic' ? 'active' : ''}`}
                onClick={() => setMapMode('traffic')}
              >
                Humanitarian
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
            <span className="map-hud-pill">{sync}</span>
            <span className="map-hud-pill map-compass-pill">
              <Compass size={14} />
              HDG {compass.degrees ?? '—'}{compass.degrees === null ? '' : '°'} | Z{zoomLevel}
            </span>
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
          </div>

          <div ref={mapRef} className="leaflet-map-surface" aria-label="Fleet tracking map" />

          {!hasLocations && (
            <div className="map-empty-overlay">
              <div className="map-empty-radar-icon">
                <Radio size={28} />
              </div>
              <h2 className="map-empty-title">{error ? 'Telemetry Snapshot Unavailable' : isLoading ? 'Loading Fleet Snapshot' : 'Awaiting GPS Telemetry'}</h2>
              <p className="map-empty-desc">
                {error ? 'The tracking API could not be reached. No vehicle locations are being shown.' : 'No valid vehicle coordinates are available. The map is showing a world overview until a location is received.'}
              </p>
            </div>
          )}

          {selectedLocation && (
            <div className="telemetry-floating-card">
              <div className="telemetry-card-header">
                <div className="telemetry-icon-box">
                  <Navigation size={18} style={{ transform: `rotate(${compass.degrees ?? 0}deg)` }} />
                </div>
                <div className="telemetry-card-heading">
                  <div className="telemetry-id-row">
                    <span className="telemetry-id" title={selectedLocation.vehicleId}>{selectedLocation.vehicleId}</span>
                  </div>
                  <div className="telemetry-model-row">
                    <span>Click a marker to select another vehicle</span>
                  </div>
                </div>
                <div className="telemetry-select-btn">
                  <span className={`status-badge ${selectedLocation.status ? STATUS_BADGE_CLASS[selectedLocation.status] : 'UNKNOWN'}`}>
                    <span className="status-badge-dot" />
                    {selectedLocation.status ? STATUS_LABELS[selectedLocation.status] : 'Status unavailable'}
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
                  <strong>{compass.degrees !== null ? `${compass.degrees}° ${compass.cardinal}` : '--'}</strong>
                  <small>{compass.degrees !== null ? `Vector ${compass.cardinal}` : 'Awaiting Fix'}</small>
                </div>
                <div className="telemetry-metric">
                  <span className="metric-label">GNSS COORDINATES</span>
                  <strong>{selectedCoordinates ? `${selectedCoordinates[0].toFixed(4)}°, ${selectedCoordinates[1].toFixed(4)}°` : '--'}</strong>
                  <small>{selectedCoordinates ? 'Location received' : 'Awaiting Fix'}</small>
                </div>
                <div className="telemetry-metric">
                  <span className="metric-label">LAST TELEMETRY UPDATE</span>
                  <strong>{lastUpdate.relative}</strong>
                  <small>{lastUpdate.absolute}</small>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="map-card-footer">
          <div className="map-legend">
            <div className="legend-item"><span className="legend-dot moving" />Moving</div>
            <div className="legend-item"><span className="legend-dot stopped" />Idle</div>
            <div className="legend-item"><span className="legend-dot stale" />Stale</div>
            <div className="legend-item"><span className="legend-dot offline" />Offline</div>
          </div>
          <div className="map-attribution">© OpenStreetMap contributors • Esri • WGS84 GPS positions</div>
        </div>
      </div>
    </div>
  );
}
