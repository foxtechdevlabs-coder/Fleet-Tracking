import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Cpu,
  Crosshair,
  Layers,
  MapPinOff,
  Maximize2,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  type MapViewMode,
  type OperationalStatus,
  type Vehicle,
  isValidCoordinate,
  calculateFreshness,
} from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';
import { getHeadingCompass, formatTelemetryTime, formatCoordinates } from '../tracking/TrackingDetailsPanel';

interface MapViewportProps {
  onAddDeviceClick?: () => void;
  showFloatingTelemetryCard?: boolean;
  visibleVehicleIds?: string[];
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
    case 'UNKNOWN':     return 'Status unavailable';
    case 'OFFLINE':
    default:            return 'Offline';
  }
};

const FloatingHudCard: React.FC<FloatingHudCardProps> = ({ vehicle, onCenterMap }) => {
  const telemetry = vehicle.telemetry;
  const headingInfo = getHeadingCompass(telemetry?.heading);

  const hasLiveCoords = Boolean(
    telemetry && isValidCoordinate(telemetry.latitude, telemetry.longitude)
  );
  const isLocationUnavailable = !hasLiveCoords || Boolean(vehicle.locationUnavailable);
  const hasLastKnown = Boolean(
    vehicle.lastKnownLocation &&
      isValidCoordinate(vehicle.lastKnownLocation.latitude, vehicle.lastKnownLocation.longitude)
  );

  const pingTimestamp = telemetry?.recordedAt || telemetry?.ingestedAt || vehicle.lastKnownLocation?.recordedAt;
  const timeInfo = formatTelemetryTime(pingTimestamp);
  const freshness = calculateFreshness(pingTimestamp);
  const speed = telemetry?.speed ?? null;

  const speedPct = speed !== null ? Math.min(100, (speed / 120) * 100) : 0;

  const coordInfo = hasLiveCoords && telemetry
    ? formatCoordinates(telemetry.latitude, telemetry.longitude)
    : hasLastKnown && vehicle.lastKnownLocation
    ? formatCoordinates(vehicle.lastKnownLocation.latitude, vehicle.lastKnownLocation.longitude)
    : { latDisplay: 'Location Unavailable', lngDisplay: 'Location Unavailable' };

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
            {isLocationUnavailable && (
              <span className="hud-no-loc-badge" title="No real-time GPS coordinate packet received">
                <MapPinOff size={10} />
                <span>Loc Unavailable</span>
              </span>
            )}
            <span className="hud-make-badge">{vehicle.make} {vehicle.model}</span>
          </div>
          <div className="hud-subline">
            <span className="hud-fleet-status">
              <ShieldCheck size={11} />
              {freshness.label} ({timeInfo.relative})
            </span>
            <span className="hud-device-label">
              <Cpu size={11} />
              {vehicle.deviceId ? `Device: ${vehicle.deviceId}` : 'Device unassigned'}
            </span>
          </div>
        </div>

        <span className={`hud-op-badge hud-op-badge--${(os ?? 'UNKNOWN').toLowerCase()}`}>
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
            {speed === null ? 'Unavailable' : speed > 0 ? 'In Transit' : 'Stationary'}
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

        {/* 3. GNSS Coordinates (handles Location Unavailable + Last Known Location) */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">GNSS COORDINATES</span>
          <strong className="hud-metric-value hud-coords-stacked">
            <span>{coordInfo.latDisplay}</span>
            <span>{coordInfo.lngDisplay}</span>
          </strong>
          <span className="hud-metric-sub">
            {hasLiveCoords ? (
              <>
                <Satellite size={10} />
                {telemetry?.satelliteCount !== undefined ? `Fix: ${telemetry.satelliteCount} Sats` : 'Live GNSS Fix'}
              </>
            ) : hasLastKnown ? (
              <span className="hud-last-known-note">Last known location retained</span>
            ) : (
              <span className="hud-no-loc-note">No satellite coordinates</span>
            )}
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
              : 'Fuel sensor --'}
          </span>
        </div>

        {/* 5. Hardware Node */}
        <div className="hud-metric-tile">
          <span className="hud-metric-label">AUX VOLTAGE</span>
          <strong className="hud-metric-value">
            {telemetry?.batteryVoltage !== undefined ? `${telemetry.batteryVoltage.toFixed(1)}V` : '-- V'}
          </strong>
          <span className="hud-metric-sub">
            {telemetry?.ignition !== undefined ? (telemetry.ignition ? 'Ignition ON' : 'Ignition OFF') : 'Ignition --'}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="hud-actions">
        <button
          type="button"
          className="hud-action-btn"
          title="Center map on vehicle"
          onClick={onCenterMap}
          disabled={!hasLiveCoords && !hasLastKnown}
        >
          🎯 Center Map
        </button>
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
      return '#0284c7';
  }
};

export const MapViewport: React.FC<MapViewportProps> = ({
  onAddDeviceClick,
  showFloatingTelemetryCard = true,
  visibleVehicleIds,
}) => {
  const {
    vehicles,
    isLoading,
    apiError,
    error,
    retryTracking,
    trackingState,
    selectedVehicleId,
    setSelectedVehicleId,
  } = useFleet();

  const isRetrying = trackingState === 'retrying';

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  // Track markers map to smoothly update positions without tearing down layer
  const markersMapRef = useRef<Map<string, { marker: L.Marker; arrow?: L.Marker; isLastKnown: boolean }>>(new Map());

  const [mapMode, setMapMode] = useState<MapViewMode>('street');
  const [zoomLevel, setZoomLevel] = useState<number>(12);

  const visibleVehicles = useMemo(
    () => visibleVehicleIds ? vehicles.filter((vehicle) => visibleVehicleIds.includes(vehicle.id)) : vehicles,
    [vehicles, visibleVehicleIds]
  );

  // Vehicles with strictly valid live WGS84 coordinates (no [0, 0] Null Island)
  const activeLiveVehicles = useMemo(
    () =>
      visibleVehicles.filter(
        (vehicle) =>
          vehicle.telemetry &&
          isValidCoordinate(vehicle.telemetry.latitude, vehicle.telemetry.longitude)
      ),
    [visibleVehicles]
  );

  // Vehicles with last known location when live coordinates are unavailable
  const lastKnownVehicles = useMemo(
    () =>
      visibleVehicles.filter(
        (vehicle) =>
          (!vehicle.telemetry || !isValidCoordinate(vehicle.telemetry.latitude, vehicle.telemetry.longitude)) &&
          vehicle.lastKnownLocation &&
          isValidCoordinate(vehicle.lastKnownLocation.latitude, vehicle.lastKnownLocation.longitude)
      ),
    [visibleVehicles]
  );

  const selectedVehicle = useMemo(
    () => visibleVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? visibleVehicles[0] ?? null,
    [visibleVehicles, selectedVehicleId]
  );

  // Map Initialization
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
      markersMapRef.current.clear();
      map.remove();
      leafletMapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  // Synchronize selection
  useEffect(() => {
    if (!selectedVehicleId && visibleVehicles[0]) {
      setSelectedVehicleId(visibleVehicles[0].id);
    }
  }, [selectedVehicleId, setSelectedVehicleId, visibleVehicles]);

  // Smooth Marker Updates: Only verified coordinates, zero [0, 0] plots
  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) {
      return;
    }

    const markersMap = markersMapRef.current;
    const currentActiveIds = new Set<string>();

    // 1. Process Live Vehicles (Actual verified real-time coordinates)
    activeLiveVehicles.forEach((vehicle) => {
      const lat = vehicle.telemetry!.latitude;
      const lng = vehicle.telemetry!.longitude;
      const speed = vehicle.telemetry?.speed;
      const heading = vehicle.telemetry?.heading;
      const color = getStatusColor(vehicle.operationalStatus);

      currentActiveIds.add(vehicle.id);

      const existing = markersMap.get(vehicle.id);
      if (existing && !existing.isLastKnown) {
        // Smooth position update
        existing.marker.setLatLng([lat, lng]);
        existing.marker.setTooltipContent(
          `${vehicle.id} • ${Number.isFinite(speed) ? `${Math.round(speed!)} km/h` : 'Live Fix'}`
        );
        if (existing.arrow && typeof heading === 'number' && Number.isFinite(heading)) {
          existing.arrow.setLatLng([lat, lng]);
          const arrowEl = existing.arrow.getElement();
          if (arrowEl) {
            const rotSpan = arrowEl.querySelector('span');
            if (rotSpan) rotSpan.style.transform = `rotate(${heading}deg)`;
          }
        }
      } else {
        // Remove previous ghost/last known marker if it existed
        if (existing) {
          layer.removeLayer(existing.marker);
          if (existing.arrow) layer.removeLayer(existing.arrow);
        }

        const icon = L.divIcon({
          className: 'fleet-map-pin',
          html: `
            <span class="fleet-map-pin-core" style="background:${color}"></span>
            <span class="fleet-map-pin-ring" style="border-color:${color}"></span>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          tooltipAnchor: [0, -20],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.bindTooltip(
          `${vehicle.id} • ${Number.isFinite(speed) ? `${Math.round(speed!)} km/h` : 'Live Fix'}`,
          {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.95,
          }
        );
        marker.on('click', () => {
          setSelectedVehicleId(vehicle.id);
        });
        marker.addTo(layer);

        let arrowMarker: L.Marker | undefined;
        if (typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360) {
          const arrowIcon = L.divIcon({
            className: 'fleet-map-pin-arrow',
            html: `<span style="transform: rotate(${heading}deg)"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2 L13 11 L8 9 L3 11 Z" fill="${color}"/></svg></span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          arrowMarker = L.marker([lat, lng], {
            icon: arrowIcon,
            interactive: false,
          }).addTo(layer);
        }

        markersMap.set(vehicle.id, { marker, arrow: arrowMarker, isLastKnown: false });
      }
    });

    // 2. Process Vehicles with Last Known Location (Live coordinates unavailable)
    lastKnownVehicles.forEach((vehicle) => {
      const lat = vehicle.lastKnownLocation!.latitude;
      const lng = vehicle.lastKnownLocation!.longitude;
      const recordedTime = formatTelemetryTime(vehicle.lastKnownLocation!.recordedAt).relative;

      currentActiveIds.add(vehicle.id);

      const existing = markersMap.get(vehicle.id);
      if (existing && existing.isLastKnown) {
        existing.marker.setLatLng([lat, lng]);
        existing.marker.setTooltipContent(
          `${vehicle.id} • Last Known Location (${recordedTime}) • Live GPS Unavailable`
        );
      } else {
        if (existing) {
          layer.removeLayer(existing.marker);
          if (existing.arrow) layer.removeLayer(existing.arrow);
        }

        // Distinct dashed amber ghost pin for Last Known Location
        const ghostIcon = L.divIcon({
          className: 'fleet-map-pin last-known-pin',
          html: `
            <span class="fleet-map-pin-core" style="background:#f59e0b"></span>
            <span class="fleet-map-pin-ring last-known-ring" style="border-color:#f59e0b; border-style:dashed;"></span>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          tooltipAnchor: [0, -20],
        });

        const marker = L.marker([lat, lng], { icon: ghostIcon });
        marker.bindTooltip(
          `${vehicle.id} • Last Known Location (${recordedTime}) • Live GPS Unavailable`,
          {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.95,
          }
        );
        marker.on('click', () => {
          setSelectedVehicleId(vehicle.id);
        });
        marker.addTo(layer);

        markersMap.set(vehicle.id, { marker, isLastKnown: true });
      }
    });

    // 3. Cleanup markers for vehicles that are now absent or have no location at all
    markersMap.forEach((entry, id) => {
      if (!currentActiveIds.has(id)) {
        layer.removeLayer(entry.marker);
        if (entry.arrow) layer.removeLayer(entry.arrow);
        markersMap.delete(id);
      }
    });

    // 4. Fit map bounds smoothly
    const allValidPoints: [number, number][] = [
      ...activeLiveVehicles.map((v) => [v.telemetry!.latitude, v.telemetry!.longitude] as [number, number]),
      ...lastKnownVehicles.map((v) => [v.lastKnownLocation!.latitude, v.lastKnownLocation!.longitude] as [number, number]),
    ];

    if (allValidPoints.length > 0) {
      const bounds = L.latLngBounds(allValidPoints);
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
      setZoomLevel(map.getZoom());
    } else {
      map.setView(DEFAULT_CENTER, 11);
      setZoomLevel(11);
    }
  }, [activeLiveVehicles, lastKnownVehicles, setSelectedVehicleId]);

  const handleZoom = (direction: 'in' | 'out') => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (direction === 'in') {
      map.setZoom(map.getZoom() + 1);
    } else {
      map.setZoom(map.getZoom() - 1);
    }
    setZoomLevel(map.getZoom());
  };

  const hasAnyValidLocations = activeLiveVehicles.length > 0 || lastKnownVehicles.length > 0;
  const statusText = activeLiveVehicles.length > 0
    ? `${activeLiveVehicles.length} Live Positions`
    : lastKnownVehicles.length > 0
    ? `${lastKnownVehicles.length} Last Known Locations`
    : 'GPS Positions Unavailable';

  const headingForDisplay = selectedVehicle?.telemetry?.heading ?? null;

  return (
    <div className="map-card" aria-label="Fleet Tracking Map Viewport">
      <div className="map-card-header">
        <div className="map-card-title">
          <Radio size={16} color="#0284c7" />
          <span>Fleet Deployment Map Overview</span>
          {activeLiveVehicles.length > 0 && (
            <span className="badge-count stream">{activeLiveVehicles.length} Active Feeds</span>
          )}
          {lastKnownVehicles.length > 0 && (
            <span className="badge-count subtle">{lastKnownVehicles.length} Last Known</span>
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

          <button
            type="button"
            className="map-icon-btn"
            title="Recenter on fleet"
            onClick={() => {
              const target = activeLiveVehicles[0] || lastKnownVehicles[0];
              if (target) setSelectedVehicleId(target.id);
            }}
          >
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
          <span className={`map-hud-pill ${activeLiveVehicles.length > 0 ? 'map-hud-live' : 'map-hud-warning'}`}>
            {statusText}
          </span>
          <span className="map-hud-pill">Real-time Verified Coordinates</span>
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
          <button
            type="button"
            className="map-tool-btn"
            aria-label="Recenter map"
            onClick={() => {
              const target = activeLiveVehicles[0] || lastKnownVehicles[0];
              if (target) setSelectedVehicleId(target.id);
            }}
          >
            <Crosshair size={15} />
          </button>
          <button type="button" className="map-tool-btn" aria-label="Layers">
            <Layers size={15} />
          </button>
        </div>

        <div className="map-compass-pill">
          <Compass size={14} />
          <span>HDG {headingForDisplay ?? '--'}° | Z{zoomLevel}</span>
        </div>

        <div ref={mapRef} className="leaflet-map-surface" aria-label="Fleet tracking map" />

        {/* Empty / Error Overlay when no verified coordinates exist */}
        {!hasAnyValidLocations && (
          <div className="map-empty-overlay">
            <div className="map-empty-radar-icon">
              {isLoading || trackingState === 'retrying' ? (
                <Radio size={28} className="spin-anim" />
              ) : trackingState === 'error' ? (
                <ShieldAlert size={28} color="#ef4444" />
              ) : (
                <MapPinOff size={28} color="#94a3b8" />
              )}
            </div>

            <h2 className="map-empty-title">
              {isLoading
                ? 'Loading telematics data...'
                : trackingState === 'retrying'
                ? 'Retrying tracking connection...'
                : trackingState === 'error'
                ? `Telemetry unavailable (${apiError?.status ? `HTTP ${apiError.status}` : 'Error'})`
                : visibleVehicles.length === 0 && vehicles.length > 0
                ? 'No assets match active filters'
                : vehicles.length === 0
                ? 'No registered fleet vehicles'
                : 'GPS Locations Unavailable'}
            </h2>

            <p className="map-empty-desc">
              {trackingState === 'error'
                ? apiError?.friendlyMessage || error || 'Connection to the telemetry API failed.'
                : visibleVehicles.length === 0 && vehicles.length > 0
                ? 'Change filter criteria or search query to display vehicles.'
                : vehicles.length === 0
                ? 'Zero vehicle records registered in database.'
                : 'Zero valid WGS84 coordinates received. Synthetic fallback [0, 0] plotting is disabled.'}
            </p>

            {apiError?.actionableAdvice && (
              <p className="map-empty-hint">{apiError.actionableAdvice}</p>
            )}

            {(trackingState === 'error' || isRetrying) && apiError?.canRetry !== false && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void retryTracking()}
                disabled={isRetrying}
              >
                <RefreshCw size={15} className={isRetrying ? 'spin-anim' : ''} />
                <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
              </button>
            )}

            {!apiError && onAddDeviceClick && vehicles.length === 0 && (
              <button type="button" className="btn-primary" onClick={onAddDeviceClick}>
                <Plus size={15} />
                <span>Connect Device &amp; Vehicle</span>
              </button>
            )}
          </div>
        )}

        {/* Floating HUD Card for selected vehicle */}
        {showFloatingTelemetryCard && selectedVehicle && (
          <FloatingHudCard
            vehicle={selectedVehicle}
            onCenterMap={() => {
              const map = leafletMapRef.current;
              if (!map) return;
              const t = selectedVehicle.telemetry;
              if (t && isValidCoordinate(t.latitude, t.longitude)) {
                map.setView([t.latitude, t.longitude], 15, { animate: true });
              } else if (
                selectedVehicle.lastKnownLocation &&
                isValidCoordinate(selectedVehicle.lastKnownLocation.latitude, selectedVehicle.lastKnownLocation.longitude)
              ) {
                map.setView(
                  [selectedVehicle.lastKnownLocation.latitude, selectedVehicle.lastKnownLocation.longitude],
                  15,
                  { animate: true }
                );
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
          <div className="legend-item"><span className="legend-dot last-known" />Last Known Position</div>
        </div>
        <div className="map-attribution">EPSG:3857 • Zero Synthetic Markers • Realtime WGS84 Fixes</div>
      </div>
    </div>
  );
};
