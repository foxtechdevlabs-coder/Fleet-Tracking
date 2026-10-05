import React from "react";
import { Save, Server, Bell } from "lucide-react";

function SettingsPage() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">GATEWAY & CONSOLE PREFERENCES</div>
          <h1>System & Telemetry Settings</h1>
          <p>Hardware protocol ingestion ports, alert triggers, geofence parameters & API keys</p>
        </div>
        <button className="add-fleet-btn"><Save size={13} /> Save Configuration</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
        <div className="stat-card" style={{ height: "auto", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", color: "#1e3e62", fontWeight: "700" }}>
            <Server size={16} />
            <span>Telemetry Ingestion Gateway</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
            <div>
              <label style={{ display: "block", color: "#64748b", marginBottom: "4px" }}>WebSocket Real-Time Stream URL</label>
              <input type="text" readOnly value="wss://telemetry.fleettrack.internal/v1/stream" style={{ width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "11px", background: "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", color: "#64748b", marginBottom: "4px" }}>Active Ingestion Protocol</label>
              <input type="text" readOnly value="Teltonika Codec 8 / 8E Extended (TCP/UDP 5027)" style={{ width: "100%", padding: "8px", border: "1px solid #e2e8f0", borderRadius: "5px", fontSize: "11px", background: "#f8fafc" }} />
            </div>
          </div>
        </div>

        <div className="stat-card" style={{ height: "auto", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", color: "#1e3e62", fontWeight: "700" }}>
            <Bell size={16} />
            <span>Alert & Threshold Rules</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" defaultChecked />
              <span>Instant push on GPS Signal Loss (&gt; 15 mins)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" defaultChecked />
              <span>Harsh acceleration / braking G-sensor alerts</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" defaultChecked />
              <span>Geofence deviation emergency broadcast</span>
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}

export default SettingsPage;
