import React from "react";
import { Download } from "lucide-react";

function ReportsPage() {
  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">ANALYTICS & FLEET METRICS</div>
          <h1>Operational Fleet Reports</h1>
          <p>Fuel optimization, distance traversed, driver scoring & hardware reliability metrics</p>
        </div>
        <button className="add-fleet-btn"><Download size={13} /> Generate Executive Summary</button>
      </div>

      <div className="stats" style={{ marginTop: "10px" }}>
        <div className="stat-card">
          <span>TOTAL DISTANCE</span>
          <strong>14,892 km</strong>
          <small>+12.4% vs last week</small>
        </div>
        <div className="stat-card">
          <span>FLEET FUEL EFFICIENCY</span>
          <strong className="green">4.2 km/L</strong>
          <small>Target: 4.0 km/L</small>
        </div>
        <div className="stat-card">
          <span>IDLE TIME RATE</span>
          <strong>8.2%</strong>
          <small>Down by 1.6%</small>
        </div>
        <div className="stat-card">
          <span>AVERAGE SPEED</span>
          <strong>46.8 km/h</strong>
          <small>Regional logistics corridors</small>
        </div>
        <div className="stat-card">
          <span>SENSOR UPTIME</span>
          <strong className="green">99.8%</strong>
          <small>Cellular handshake nominal</small>
        </div>
      </div>
    </main>
  );
}

export default ReportsPage;
