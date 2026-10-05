import React from "react";
import { Calendar, Download } from "lucide-react";

function HistoryPage() {
  const logs = [
    { id: "LOG-9821", time: "11:42:01 AM", vehicle: "VH-001", event: "Speed Advisory (54 km/h in 50 km/h zone)", loc: "NH44 Outer Bypass", status: "Resolved" },
    { id: "LOG-9820", time: "11:39:12 AM", vehicle: "VH-002", event: "Engine Idle Exceeded (>15 mins)", loc: "Madhavaram Terminal", status: "Logged" },
    { id: "LOG-9819", time: "11:18:22 AM", vehicle: "VH-004", event: "Cell Ingestion Timeout (>15m no ping)", loc: "Sector 2 Transit Bay", status: "Alerted" },
    { id: "LOG-9818", time: "10:55:00 AM", vehicle: "VH-012", event: "Geofence Enter (Hub 01 Chennai)", loc: "Gate 3 Inbound", status: "Logged" },
  ];

  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">TELEMETRY AUDIT TRAIL</div>
          <h1>Telemetry & Route Ingestion History</h1>
          <p>Historical sensor events, diagnostic fault records & trip playback logs</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="columns-btn" style={{ height: "36px" }}><Calendar size={13} /> Last 24 Hours</button>
          <button className="add-fleet-btn"><Download size={13} /> Export CSV</button>
        </div>
      </div>

      <div className="watchlist" style={{ marginTop: "16px" }}>
        <div className="watchlist-header">
          <h2>Recorded Telemetry Event Streams</h2>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Showing 4 latest diagnostic events</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>LOG ID</th>
              <th>TIMESTAMP</th>
              <th>TARGET VEHICLE</th>
              <th>EVENT DESCRIPTION</th>
              <th>GEOLOCATION</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td><strong>{log.id}</strong></td>
                <td>{log.time}</td>
                <td><span style={{ color: "#1e3e62", fontWeight: "600" }}>{log.vehicle}</span></td>
                <td>{log.event}</td>
                <td>{log.loc}</td>
                <td>
                  <span className={`badge ${log.status === "Alerted" ? "offline" : log.status === "Resolved" ? "moving" : "stopped"}`}>
                    ● {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default HistoryPage;
