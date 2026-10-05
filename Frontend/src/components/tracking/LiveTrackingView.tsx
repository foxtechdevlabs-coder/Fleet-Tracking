import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Radio,
  Navigation,
  Compass,
  Zap,
  Fuel,
  Gauge,
  Cpu,
  Clock,
  CheckCircle,
  RotateCw,
  Search
} from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import type { Vehicle, TelemetryData } from '../../types/telemetry';

export const LiveTrackingView: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId?: string }>();
  const navigate = useNavigate();
  const { vehicles } = useFleet();

  const [inputVehicleId, setInputVehicleId] = useState(vehicleId || '');
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryData | null>(null);
  const [isSimulatingFeed, setIsSimulatingFeed] = useState<boolean>(true);

  // Find vehicle in state or initialize telemetry session for requested ID
  useEffect(() => {
    const idToLookup = vehicleId || 'VH-001';
    setInputVehicleId(idToLookup);

    const found = vehicles.find(v => v.id.toLowerCase() === idToLookup.toLowerCase() || v.plateNumber.toLowerCase() === idToLookup.toLowerCase());
    if (found) {
      setActiveVehicle(found);
      setLiveTelemetry(found.telemetry || null);
    } else {
      // Create active tracked telemetry session for this requested vehicle ID
      const dynamicVehicle: Vehicle = {
        id: idToLookup.toUpperCase(),
        plateNumber: idToLookup.startsWith('TN') || idToLookup.startsWith('KA') ? idToLookup.toUpperCase() : `TN 09 BX ${Math.floor(1000 + Math.random() * 9000)}`,
        make: 'Tata',
        model: 'Prima 4928.S',
        year: 2025,
        driverName: 'Suresh Narayanan',
        driverPhone: '+91 94441 55678',
        deviceId: `DEV-GT06-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'active',
        operationalStatus: 'MOVING',
        telemetry: {
          latitude: 12.9716,
          longitude: 77.5946,
          speed: 62,
          heading: 114,
          ignition: true,
          batteryVoltage: 13.8,
          fuelPercentage: 78,
          engineRpm: 1450,
          odometerKm: 28410,
          satelliteCount: 14,
          recordedAt: new Date().toISOString(),
          ingestedAt: new Date().toISOString(),
        }
      };
      setActiveVehicle(dynamicVehicle);
      setLiveTelemetry(dynamicVehicle.telemetry || null);
    }
  }, [vehicleId, vehicles]);

  // Live simulation tick for telematics ping
  useEffect(() => {
    if (!isSimulatingFeed || !activeVehicle) return;

    const interval = setInterval(() => {
      setLiveTelemetry(prev => {
        if (!prev) return null;
        const speedDelta = (Math.random() - 0.48) * 3;
        const newSpeed = Math.max(0, Math.min(95, Math.round((prev.speed || 60) + speedDelta)));
        const newLat = prev.latitude + (Math.random() - 0.5) * 0.0003;
        const newLng = prev.longitude + (Math.random() - 0.5) * 0.0003;

        return {
          ...prev,
          speed: newSpeed,
          heading: (prev.heading + Math.round((Math.random() - 0.5) * 4) + 360) % 360,
          latitude: newLat,
          longitude: newLng,
          recordedAt: new Date().toISOString(),
          ingestedAt: new Date().toISOString(),
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulatingFeed, activeVehicle]);

  const handleSearchVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVehicleId.trim()) return;
    navigate(`/tracking/${encodeURIComponent(inputVehicleId.trim())}`);
  };

  return (
    <div className="tracking-view-container">
      {/* Top Bar with Back Navigation & Vehicle Quick Switcher */}
      <div className="tracking-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/')}
            title="Return to Operational Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Operational Dashboard</span>
          </button>

          <div className="tracking-vehicle-details">
            <span className="plate-badge" style={{ fontSize: '0.9rem', padding: '5px 12px' }}>
              <div className="flag-strip" />
              <span>{activeVehicle?.plateNumber || 'TN 74 AB 1234'}</span>
            </span>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                  {activeVehicle?.id || 'VH-001'}
                </span>
                <span className="status-badge MOVING">
                  <span className="status-badge-dot" />
                  <span>TRANSMITTING</span>
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                {activeVehicle?.make} {activeVehicle?.model} • Driver: <strong>{activeVehicle?.driverName || 'Suresh Narayanan'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Switcher Input */}
        <form onSubmit={handleSearchVehicle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="search-input-box" style={{ width: '220px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Switch Vehicle ID..."
              value={inputVehicleId}
              onChange={(e) => setInputVehicleId(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}>
            <span>Focus</span>
          </button>
        </form>
      </div>

      {/* Telemetry Sensor HUD Metric Cards */}
      <div className="tracking-hud-grid">
        {/* Speed */}
        <div className="hud-stat-box" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="hud-stat-label">Live Speed</div>
          <div className="hud-stat-value" style={{ color: '#0284c7' }}>
            {liveTelemetry?.speed ?? 0} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>km/h</span>
          </div>
          <div className="hud-stat-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Compass size={12} />
            <span>HDG {liveTelemetry?.heading ?? 0}° • Cruise Nominal</span>
          </div>
        </div>

        {/* Coordinates */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">GPS WGS84 Fix</div>
          <div className="hud-stat-value" style={{ fontSize: '1rem', color: '#1e293b' }}>
            {liveTelemetry?.latitude.toFixed(4)}° N
          </div>
          <div className="hud-stat-sub">
            {liveTelemetry?.longitude.toFixed(4)}° E • 14 Satellites Locked
          </div>
        </div>

        {/* Ignition */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">Ignition State</div>
          <div className="hud-stat-value" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            <span>ON</span>
          </div>
          <div className="hud-stat-sub">
            RPM: {liveTelemetry?.engineRpm || 1450} • Alternator Active
          </div>
        </div>

        {/* Battery */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">Chassis Battery</div>
          <div className="hud-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={18} color="#f59e0b" />
            <span>{liveTelemetry?.batteryVoltage ?? 13.8} V</span>
          </div>
          <div className="hud-stat-sub">
            Health: 98% • Charging OK
          </div>
        </div>

        {/* Fuel */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">Fuel Level</div>
          <div className="hud-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Fuel size={18} color="#0d9488" />
            <span>{liveTelemetry?.fuelPercentage ?? 78}%</span>
          </div>
          <div className="hud-stat-sub">
            Range: ~420 km estimated
          </div>
        </div>

        {/* Odometer */}
        <div className="hud-stat-box">
          <div className="hud-stat-label">Odometer</div>
          <div className="hud-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Gauge size={18} color="#64748b" />
            <span>{Number(liveTelemetry?.odometerKm || 28410).toLocaleString()} km</span>
          </div>
          <div className="hud-stat-sub">
            Trip Met: 184.2 km
          </div>
        </div>
      </div>

      {/* Main Focus Map Canvas & Telematics Stream */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '20px' }}>
        {/* Live Vehicle Focus Canvas */}
        <div className="map-card" style={{ minHeight: '520px' }}>
          <div className="map-card-header">
            <div className="map-card-title">
              <Radio size={16} color="#0284c7" />
              <span>Realtime GPS Track: {activeVehicle?.plateNumber}</span>
              <span className="badge-count stream">MQTT Beacon Active</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={() => setIsSimulatingFeed(prev => !prev)}
              >
                <RotateCw size={12} className={isSimulatingFeed ? 'spin-anim' : ''} />
                <span>{isSimulatingFeed ? 'Telemetry Streaming' : 'Feed Paused'}</span>
              </button>
            </div>
          </div>

          <div className="map-canvas-container satellite-mode" style={{ minHeight: '440px' }}>
            <div className="radar-sweep" />

            {/* Vehicle Pin Focus */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 10,
              transform: 'scale(1.15)',
              transition: 'all 0.5s ease',
            }}>
              {/* Floating Head-Up Pill */}
              <div style={{
                background: '#0284c7',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '2px solid #38bdf8',
                boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)',
                marginBottom: '8px'
              }}>
                <Navigation size={15} style={{ transform: `rotate(${liveTelemetry?.heading || 0}deg)` }} />
                <span>{activeVehicle?.plateNumber} • {liveTelemetry?.speed || 0} km/h</span>
              </div>

              {/* Glowing Pulse Node */}
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#10b981',
                border: '4px solid #ffffff',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-8px',
                  borderRadius: '50%',
                  border: '3px solid #10b981',
                  animation: 'pulse-ring 2s infinite'
                }} />
              </div>
            </div>

            {/* Breadcrumb path overlay indicator */}
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '12px 18px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              zIndex: 10
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Ingestion Node Device</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                  {activeVehicle?.deviceId || 'DEV-GT06-984210'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Packet Ingestion Latency</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#10b981' }}>
                  42 ms • TLS 1.3
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* In-depth Vehicle Telemetry Feed & Driver Info */}
        <div style={{ display: 'flex', flex_direction: 'column', gap: '16px' } as React.CSSProperties}>
          {/* Driver & Chassis Details */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-title">
                <Cpu size={16} color="#0284c7" />
                <span>Hardware &amp; Driver Bonding</span>
              </div>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Assigned Driver</div>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>{activeVehicle?.driverName || 'Suresh Narayanan'}</div>
                <div style={{ color: '#0284c7', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  {activeVehicle?.driverPhone || '+91 94441 55678'}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Chassis Model</div>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>
                  {activeVehicle?.make} {activeVehicle?.model} ({activeVehicle?.year})
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Tracking Device IMEI</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#334155' }}>
                  {activeVehicle?.deviceId || 'DEV-GT06-984210'}
                </div>
              </div>

              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.74rem',
                color: '#065f46'
              }}>
                <CheckCircle size={14} />
                <span>Firmware v3.4.1 — All CANbus sensors responsive</span>
              </div>
            </div>
          </div>

          {/* Telemetry Stream Log */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-title">
                <Clock size={16} color="#0284c7" />
                <span>Live GPS Feed Events</span>
              </div>
            </div>

            <div className="panel-card-body" style={{ maxHeight: '240px' }}>
              <div className="timeline-list">
                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-summary">GPS Coordinate Ping: {liveTelemetry?.latitude.toFixed(4)}, {liveTelemetry?.longitude.toFixed(4)}</div>
                    <div className="timeline-meta">Speed: {liveTelemetry?.speed} km/h • Heading: {liveTelemetry?.heading}°</div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-summary">CANbus Heartbeat Acknowledged</div>
                    <div className="timeline-meta">Ignition ON • Fuel: {liveTelemetry?.fuelPercentage}%</div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-summary">Geofence Corridor Active (NH-45 Express)</div>
                    <div className="timeline-meta">Within designated commercial logistics route</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
