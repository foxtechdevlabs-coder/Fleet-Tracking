import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crosshair,
  Layers,
  Radio,
  Plus,
  Navigation,
  Compass,
  Maximize2
} from 'lucide-react';
import type { MapViewMode } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';

interface MapViewportProps {
  onAddDeviceClick: () => void;
}

export const MapViewport: React.FC<MapViewportProps> = ({ onAddDeviceClick }) => {
  const navigate = useNavigate();
  const { vehicles, selectedVehicleId, setSelectedVehicleId } = useFleet();
  const [mapMode, setMapMode] = useState<MapViewMode>('satellite');
  const [zoomLevel, setZoomLevel] = useState<number>(12);

  const activeVehiclesWithCoords = vehicles.filter(v => v.telemetry && v.telemetry.latitude && v.telemetry.longitude);
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="map-card">
      {/* Map Header Controls */}
      <div className="map-card-header">
        <div className="map-card-title">
          <Radio size={16} color="#0284c7" />
          <span>Live Fleet Deployment Map Overview</span>
          {activeVehiclesWithCoords.length > 0 && (
            <span className="badge-count stream">
              {activeVehiclesWithCoords.length} Active Nodes
            </span>
          )}
        </div>

        <div className="map-card-controls">
          {/* Street / Satellite / Traffic Hybrid */}
          <div className="map-mode-toggle" role="group" aria-label="Map style selector">
            <button
              type="button"
              className={`map-mode-btn ${mapMode === 'street' ? 'active' : ''}`}
              onClick={() => setMapMode('street')}
            >
              Street
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
              Traffic Hybrid
            </button>
          </div>

          <button
            type="button"
            className="map-icon-btn"
            title="Recenter on Fleet Centroid"
            onClick={() => {
              if (vehicles.length > 0) {
                setSelectedVehicleId(vehicles[0].id);
              }
            }}
          >
            <Crosshair size={15} />
          </button>

          <button
            type="button"
            className="map-icon-btn"
            title="Toggle Geo-fences & Traffic Layers"
          >
            <Layers size={15} />
          </button>
        </div>
      </div>

      {/* Map Canvas with Simulation Background & Markers */}
      <div className={`map-canvas-container ${mapMode}-mode`}>
        <div className="radar-sweep" />

        {/* Zoom Controls (+ / -) */}
        <div className="map-zoom-controls">
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => setZoomLevel(prev => Math.min(prev + 1, 18))}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="map-zoom-btn"
            onClick={() => setZoomLevel(prev => Math.max(prev - 1, 4))}
            title="Zoom Out"
          >
            –
          </button>
        </div>

        {/* Compass indicator */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: '#38bdf8',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10
        }}>
          <Compass size={14} />
          <span>HDG 090° E | Z{zoomLevel}</span>
        </div>

        {/* If no vehicles exist in the feed, display the clean awaiting telemetry overlay */}
        {activeVehiclesWithCoords.length === 0 ? (
          <div className="map-empty-overlay">
            <div className="map-empty-radar-icon">
              <Radio size={28} />
            </div>
            <h2 className="map-empty-title">Awaiting Live Telemetry Stream</h2>
            <p className="map-empty-desc">
              No bonded GPS telemetry nodes are transmitting position beacons. Select a vehicle from the watchlist or bond a GPS hardware device to commence live tracking.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onAddDeviceClick}
            >
              <Plus size={15} />
              <span>Connect Device &amp; Vehicle</span>
            </button>
          </div>
        ) : (
          /* When vehicles are registered/bonded, render map pin markers */
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            {activeVehiclesWithCoords.map((v, index) => {
              // Offset slightly for visual pin presentation
              const xOffset = ((index % 3) - 1) * 120;
              const yOffset = (Math.floor(index / 3) - 1) * 80;
              const isSelected = v.id === selectedVehicleId;

              return (
                <div
                  key={v.id}
                  style={{
                    position: 'absolute',
                    transform: `translate(${xOffset}px, ${yOffset}px)`,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onClick={() => setSelectedVehicleId(v.id)}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}>
                    {/* Floating Info Pill */}
                    <div style={{
                      background: isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.88)',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                      marginBottom: '4px'
                    }}>
                      <Navigation size={12} style={{ transform: `rotate(${v.telemetry?.heading || 0}deg)` }} />
                      <span>{v.id} ({v.telemetry?.speed || 0} km/h)</span>
                    </div>

                    {/* Marker Beacon */}
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: v.operationalStatus === 'MOVING' ? '#10b981' : v.operationalStatus === 'STOPPED' ? '#f59e0b' : '#64748b',
                      border: '3px solid #ffffff',
                      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                      position: 'relative'
                    }}>
                      {v.operationalStatus === 'MOVING' && (
                        <div style={{
                          position: 'absolute',
                          inset: '-4px',
                          borderRadius: '50%',
                          border: '2px solid #10b981',
                          animation: 'pulse-ring 2s infinite'
                        }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Selected vehicle quick HUD bar */}
            {selectedVehicle && (
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '20px',
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                color: '#ffffff',
                pointerEvents: 'auto',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Target Locked</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem', color: '#38bdf8' }}>
                    {selectedVehicle.id} • {selectedVehicle.plateNumber}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  <div>{selectedVehicle.telemetry?.speed || 0} km/h</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                    {selectedVehicle.telemetry?.latitude.toFixed(4)}, {selectedVehicle.telemetry?.longitude.toFixed(4)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-track-now"
                  style={{ background: '#0284c7', color: '#ffffff' }}
                  onClick={() => navigate(`/tracking/${selectedVehicle.id}`)}
                >
                  <Maximize2 size={13} />
                  <span>Inspect Vehicle Telemetry</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="map-card-footer">
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-dot moving" />
            <span>Moving</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot stopped" />
            <span>Stopped</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot offline" />
            <span>Offline</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot maint" />
            <span>Maint</span>
          </div>
        </div>

        <div className="map-attribution">
          EPSG:3857 • WGS84 GPS Telemetry Feed • Refresh: 1000ms
        </div>
      </div>
    </div>
  );
};
