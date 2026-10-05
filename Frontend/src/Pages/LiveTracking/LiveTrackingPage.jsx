import React, { useState } from "react";
import { Navigation, Compass, Layers, Maximize2, ShieldAlert } from "lucide-react";
import "./LiveTrackingPage.css";

function LiveTrackingPage() {
  const [selectedPin, setSelectedPin] = useState("VH-001");

  return (
    <main className="content">
      <div className="tracking-header">
        <div>
          <div className="section-label">REAL-TIME GPS TELEMETRY</div>
          <h1>Live Tactical Fleet Tracking</h1>
          <p>Sub-second geodetic telemetry streams, speed vector visualization and route fences</p>
        </div>

        <div className="tracking-status-badge">
          <span className="pulse-dot"></span>
          <span>Gateway Stream: 42 Hz (Nominal)</span>
        </div>
      </div>

      <div className="tracking-canvas-container">
        <div className="tracking-map-panel">
          <div className="map-toolbar">
            <div className="map-layer-options">
              <button className="layer-btn active"><Layers size={13} /> Satellite & Hybrid</button>
              <button className="layer-btn"><Compass size={13} /> Heading Lock</button>
            </div>
            <button className="full-screen-btn"><Maximize2 size={13} /> Fullscreen</button>
          </div>

          <div className="tactical-map">
            <div className="tactical-grid"></div>
            <div className="sector-tag">SECTOR 04 - SOUTH CORRIDOR</div>

            {/* Vehicle Markers */}
            <div
              className={`tactical-pin pin-1 ${selectedPin === "VH-001" ? "active-pin" : ""}`}
              onClick={() => setSelectedPin("VH-001")}
            >
              <Navigation size={12} className="pin-arrow" />
              <span>VH-001 (54 km/h)</span>
            </div>

            <div
              className={`tactical-pin pin-2 ${selectedPin === "VH-012" ? "active-pin" : ""}`}
              onClick={() => setSelectedPin("VH-012")}
            >
              <Navigation size={12} className="pin-arrow" />
              <span>VH-012 (62 km/h)</span>
            </div>

            <div
              className={`tactical-pin pin-3 ${selectedPin === "VH-002" ? "active-pin" : ""}`}
              onClick={() => setSelectedPin("VH-002")}
            >
              <span className="idle-dot"></span>
              <span>VH-002 (Idle)</span>
            </div>
          </div>
        </div>

        <div className="tracking-sidebar-telemetry">
          <h3>Telemetry Sensor Feed</h3>
          <div className="telemetry-vehicle-badge">
            <strong>Target: {selectedPin}</strong>
            <span className="online-tag">Online</span>
          </div>

          <div className="telemetry-metric-grid">
            <div className="tele-card">
              <span className="tele-label">Instant Speed</span>
              <strong className="tele-val">54.2 km/h</strong>
            </div>
            <div className="tele-card">
              <span className="tele-label">Heading Vector</span>
              <strong className="tele-val">42° North-East</strong>
            </div>
            <div className="tele-card">
              <span className="tele-label">Engine RPM</span>
              <strong className="tele-val">1,480 RPM</strong>
            </div>
            <div className="tele-card">
              <span className="tele-label">Coolant Temp</span>
              <strong className="tele-val">88° C</strong>
            </div>
            <div className="tele-card">
              <span className="tele-label">GPS Satellites</span>
              <strong className="tele-val">14 Locked</strong>
            </div>
            <div className="tele-card">
              <span className="tele-label">Ingest Latency</span>
              <strong className="tele-val">85 ms</strong>
            </div>
          </div>

          <div className="geofence-box">
            <div className="geofence-header">
              <ShieldAlert size={14} className="geo-icon" />
              <strong>Active Geofence Rules</strong>
            </div>
            <p>Chennai Industrial Corridor #4 — Speed Threshold 65 km/h (Clear)</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default LiveTrackingPage;
