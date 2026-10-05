import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  AlertTriangle,
  Plus,
  Search,
  SlidersHorizontal,
  Navigation,
  Truck,
  Plug,
  Circle,
  Pause,
  Signal,
  Clock,
  Crosshair,
  Wrench,
  Layers,
  ChevronRight
} from "lucide-react";
import "./Cont.css";

const vehicleWatchlistData = [
  {
    id: "VH-001",
    plate: "TN 74 AB 1234",
    driver: "R. Saravanan",
    status: "MOVING",
    statusType: "moving",
    speed: "54 km/h",
    heading: "NE [042°]",
    lastPing: "Just now",
    lastTime: "(11:42:04)",
    coords: "13.0827° N, 80.2707° E",
    actionType: "track"
  },
  {
    id: "VH-002",
    plate: "TN 75 CD 5678",
    driver: "K. Anbarasan",
    status: "STOPPED",
    statusType: "stopped",
    speed: "0 km/h",
    heading: "Idle 24m",
    lastPing: "11:39:12 AM",
    lastTime: "",
    coords: "12.8815° N, 80.2180° E",
    actionType: "track"
  },
  {
    id: "VH-004",
    plate: "TN 09 BK 4432",
    driver: "P. Muthuvel",
    status: "OFFLINE",
    statusType: "offline",
    speed: "--",
    heading: "",
    lastPing: "11:18:22 AM",
    lastTime: "(>23m)",
    coords: "13.1200° N, 80.1400° E",
    actionType: "track"
  },
  {
    id: "VH-012",
    plate: "TN 22 EX 8809",
    driver: "D. Senthil Kumar",
    status: "MOVING",
    statusType: "moving",
    speed: "62 km/h",
    heading: "E [090°]",
    lastPing: "11:41:48 AM",
    lastTime: "",
    coords: "12.9249° N, 80.1000° E",
    actionType: "track"
  },
  {
    id: "VH-018",
    plate: "TN 10 CZ 2041",
    driver: "V. Balaji",
    status: "MAINTENANCE",
    statusType: "maintenance",
    speed: "0 km/h",
    heading: "Bay 3",
    lastPing: "10:14:02 AM",
    lastTime: "",
    coords: "13.0012° N, 80.2015° E",
    actionType: "workorder"
  }
];

function Cont() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeMapLayer, setActiveMapLayer] = useState("street");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState("26 Sep 2026, 11:42 AM IST");

  const filteredVehicles = vehicleWatchlistData.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.id.toLowerCase().includes(q) ||
      v.plate.toLowerCase().includes(q) ||
      v.driver.toLowerCase().includes(q) ||
      v.status.toLowerCase().includes(q)
    );
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      setLastRefreshedAt(
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }) +
          ", " +
          now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }) +
          " IST"
      );
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <main className="content">
      {/* Header Row */}
      <section className="dashboard-header">
        <div>
          <div className="section-label-row">
            <span className="section-label">LOGISTICS COMMAND CENTER</span>
            <span className="live-label">
              <ChevronRight size={11} className="label-arrow" /> LIVE TELEMETRY FLEET
            </span>
          </div>

          <h1>Operational Fleet Dashboard</h1>
          <p>Real-time telemetry, fleet availability & active operational events</p>
        </div>

        <div className="dashboard-actions">
          <div className="header-top-buttons">
            <div className="date-box">
              <div className="date-main">
                <Clock size={12} className="date-icon" />
                <span>{lastRefreshedAt}</span>
              </div>
              <small>Asia/Kolkata Node Ingestion</small>
            </div>

            <button
              className={`refresh-btn ${isRefreshing ? "spinning" : ""}`}
              onClick={handleRefresh}
              title="Refresh active sensor telemetry"
            >
              <RefreshCw size={13} className={isRefreshing ? "spin-icon" : ""} />
              <span>Refresh Telemetry</span>
            </button>

            <button className="emergency-btn" title="Broadcast emergency dispatch">
              <AlertTriangle size={13} />
              <span>Emergency Broadcast</span>
            </button>
          </div>

          {/* Add Device & Vehicle Action Button */}
          <button
            className="add-btn"
            onClick={() => navigate("/device-vehicle")}
            title="Register & bond new hardware tracker and transport vehicle"
          >
            <Plus size={14} />
            <span>+ Add Device & Vehicle</span>
          </button>
        </div>
      </section>

      {/* 5 Stats Cards Row */}
      <section className="stats">
        <div className="stat-card">
          <div className="stat-header">
            <span>FLEET POOL</span>
            <Truck size={15} className="stat-icon-muted" />
          </div>
          <strong className="stat-value">48</strong>
          <div className="stat-sub-row">
            <span>42 In Svc</span>
            <span>6 Spare</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>ACTIVE UNITS</span>
            <Plug size={15} className="stat-icon-teal" />
          </div>
          <strong className="stat-value text-teal">39</strong>
          <small className="stat-pill-teal">81.2% Deployed</small>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>MOVING</span>
            <Circle size={10} className="stat-icon-circle-green" fill="#10B981" />
          </div>
          <strong className="stat-value">26</strong>
          <small className="stat-speed-label">
            <Clock size={10} /> 48 km/h avg
          </small>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>STOPPED</span>
            <Pause size={13} className="stat-icon-muted" />
          </div>
          <strong className="stat-value">13</strong>
          <small className="stat-text-muted">Idle / Staged</small>
        </div>

        <div className="stat-card offline">
          <div className="stat-header">
            <span>OFFLINE</span>
            <Signal size={14} className="stat-icon-red" />
          </div>
          <strong className="stat-value text-red">05</strong>
          <small className="stat-text-red">
            <Clock size={10} /> &gt;15m no ping
          </small>
        </div>
      </section>

      {/* Main Grid: Map Overview (Left) + Critical Alerts & Activity Log (Right) */}
      <section className="dashboard-grid">
        {/* Map Card */}
        <div className="map-card">
          <div className="map-title-bar">
            <div className="map-title-left">
              <Navigation size={14} className="map-compass-icon" />
              <strong>Live Fleet Deployment Map Overview</strong>
              <span className="corridor-pill">Chennai Corridors</span>
            </div>

            <div className="map-layer-controls">
              <button
                className={`layer-toggle-btn ${activeMapLayer === "street" ? "active" : ""}`}
                onClick={() => setActiveMapLayer("street")}
              >
                Street
              </button>
              <button
                className={`layer-toggle-btn ${activeMapLayer === "satellite" ? "active" : ""}`}
                onClick={() => setActiveMapLayer("satellite")}
              >
                Satellite
              </button>
              <button
                className={`layer-toggle-btn ${activeMapLayer === "traffic" ? "active" : ""}`}
                onClick={() => setActiveMapLayer("traffic")}
              >
                Traffic Hybrid
              </button>
              <span className="map-util-icons">
                <Crosshair size={13} className="util-icon" />
                <Layers size={13} className="util-icon" />
              </span>
            </div>
          </div>

          <div className="map-canvas-area">
            {/* Visual Chennai Cartography Canvas */}
            <div className="chennai-map-visual">
              <div className="chennai-bay-water">
                <span className="water-label">Marina Beach</span>
              </div>

              {/* Highway Corridors */}
              <div className="road road-h48"></div>
              <div className="road road-nh44"></div>
              <div className="road road-inner"></div>

              {/* City Hub Labels */}
              <span className="city-spot spot-annanur">Annanur</span>
              <span className="city-spot spot-ambattur">Ambattur</span>
              <span className="city-spot spot-perambur">Perambur</span>
              <span className="city-spot spot-egmore">Egmore</span>
              <span className="city-spot spot-tnagar">T. Nagar</span>
              <span className="city-spot spot-stthomas">St. Thomas Mount</span>
              <span className="city-spot spot-pammal">Pammal</span>
              <span className="city-spot spot-nanganallur">Nanganallur</span>

              {/* Central City Label */}
              <div className="central-city-title">
                <span>Chennai</span>
                <small>சென்னை</small>
              </div>

              {/* Vehicle Markers matching Screenshot */}
              <div
                className={`chennai-marker marker-vh012 ${selectedVehicle === "VH-012" ? "marker-active" : ""}`}
                onClick={() => setSelectedVehicle("VH-012")}
              >
                <span className="marker-dot dot-green"></span>
                <strong>VH-012</strong>
                <span className="marker-speed-tag">62 km/h</span>
              </div>

              <div
                className={`chennai-marker marker-vh001 ${selectedVehicle === "VH-001" ? "marker-active" : ""}`}
                onClick={() => setSelectedVehicle("VH-001")}
              >
                <span className="marker-dot dot-green"></span>
                <strong>VH-001</strong>
                <span className="marker-speed-tag">54 km/h</span>
              </div>

              <div
                className={`chennai-marker marker-vh002 ${selectedVehicle === "VH-002" ? "marker-active" : ""}`}
                onClick={() => setSelectedVehicle("VH-002")}
              >
                <span className="marker-dot dot-blue"></span>
                <strong>VH-002</strong>
                <span className="marker-state-tag">Stopped</span>
              </div>

              <div
                className={`chennai-marker marker-vh004-offline ${selectedVehicle === "VH-004" ? "marker-active" : ""}`}
                onClick={() => setSelectedVehicle("VH-004")}
              >
                <AlertTriangle size={11} className="marker-warn-icon" />
                <strong>VH-004</strong>
                <span className="offline-state-tag">Offline</span>
              </div>

              {/* Cluster Badge */}
              <div className="cluster-badge">+7</div>

              {/* Zoom Controls */}
              <div className="map-zoom-buttons">
                <button className="zoom-btn" title="Zoom in">+</button>
                <button className="zoom-btn" title="Zoom out">-</button>
              </div>
            </div>

            {/* Bottom Map Legend */}
            <div className="map-bottom-legend">
              <span className="legend-item">
                <span className="legend-dot green"></span> Moving (26)
              </span>
              <span className="legend-item">
                <span className="legend-dot blue"></span> Stopped (13)
              </span>
              <span className="legend-item">
                <span className="legend-dot red"></span> Offline (5)
              </span>
              <span className="legend-item">
                <span className="legend-dot grey"></span> Maint. (4)
              </span>
            </div>
          </div>
        </div>

        {/* Right Side Column: Critical Alerts & Activity Log */}
        <div className="dashboard-right-column">
          {/* Card 1: Critical Operational Alerts */}
          <div className="alerts-card">
            <div className="card-heading">
              <div className="heading-left">
                <span className="bell-icon">🔔</span>
                <strong>Critical Operational Alerts</strong>
              </div>
              <span className="alert-count-pill">4 Active</span>
            </div>

            <div className="alert-list">
              <div className="alert-item red-tint">
                <div className="alert-header">
                  <span className="alert-title text-red">
                    📶 [Vehicle Offline] VH-008
                  </span>
                  <span className="alert-time">20m ago</span>
                </div>
                <p className="alert-desc">
                  TN 75 CD 9901 • Ingestion loss on NH44
                </p>
                <div className="alert-actions-row">
                  <button className="alert-action-link">Triage Route</button>
                  <span className="dot-sep">•</span>
                  <button className="alert-action-link">Ping Hardware</button>
                </div>
              </div>

              <div className="alert-item blue-tint">
                <div className="alert-header">
                  <span className="alert-title text-navy">
                    🔋 [Device Fault] GPS-014
                  </span>
                  <span className="alert-time">34m ago</span>
                </div>
                <p className="alert-desc">
                  Internal backup battery critical (3.2V)
                </p>
                <button className="alert-action-link blue-link">Run Diagnostics</button>
              </div>

              <div className="alert-item neutral-tint">
                <div className="alert-header">
                  <span className="alert-title">
                    🔄 [Interruption] GPS-009
                  </span>
                  <span className="alert-time">42m ago</span>
                </div>
                <p className="alert-desc">Packet handshake timeout (3 retries)</p>
              </div>

              <div className="alert-item neutral-tint">
                <div className="alert-header">
                  <span className="alert-title">
                    🔧 [Maintenance] VH-003
                  </span>
                  <span className="alert-time">1h ago</span>
                </div>
                <p className="alert-desc">
                  Scheduled 10,000km odometer inspection
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Recent Activity Log */}
          <div className="activity-card">
            <div className="card-heading">
              <div className="heading-left">
                <Clock size={13} className="activity-clock-icon" />
                <strong>Recent Activity Log</strong>
              </div>
              <span className="activity-stream-tag">Live Ingestion Stream</span>
            </div>

            <div className="activity-timeline">
              <div className="timeline-item">
                <span className="timeline-dot dot-green"></span>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>11:39 AM</strong>
                    <span className="user-tag">Alex Morgan</span>
                  </div>
                  <p>VH-002 assigned primary source GPS-002</p>
                </div>
              </div>

              <div className="timeline-item">
                <span className="timeline-dot dot-blue"></span>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>11:35 AM</strong>
                    <span className="system-tag">System Gateway</span>
                  </div>
                  <p>Device GPS-028 &amp; Vehicle VH-028 successfully registered</p>
                </div>
              </div>

              <div className="timeline-item">
                <span className="timeline-dot dot-teal"></span>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>11:20 AM</strong>
                    <span className="daemon-tag">Telemetry Daemon</span>
                  </div>
                  <p>
                    VH-012 transitioned to <span className="highlight-moving">Moving</span> (62 km/h, Eastward NH48)
                  </p>
                </div>
              </div>

              <div className="timeline-item">
                <span className="timeline-dot dot-muted"></span>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>11:05 AM</strong>
                    <span className="worker-tag">Sync Worker</span>
                  </div>
                  <p>Fallback GPS sensor synchronized on VH-005</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Watchlist Section */}
      <section className="watchlist">
        <div className="watchlist-header">
          <div>
            <div className="watchlist-title-row">
              <span className="watchlist-icon">📊</span>
              <h2>Quick Fleet Telemetry Watchlist</h2>
            </div>
            <p>High-frequency sensor metrics across bonded vehicles</p>
          </div>

          <div className="table-actions">
            <div className="search-input-wrap">
              <Search size={13} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter plate, vehicle, driver..."
                aria-label="Filter vehicles"
              />
            </div>

            <button className="columns-btn">
              <SlidersHorizontal size={12} />
              <span>Columns</span>
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>VEHICLE ID</th>
                <th>REGISTRATION PLATE</th>
                <th>DRIVER IN CHARGE</th>
                <th>OPERATIONAL STATUS</th>
                <th>SPEED / HEADING</th>
                <th>LAST INGESTION</th>
                <th>CURRENT COORDINATES</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredVehicles.map((vehicle) => (
                <tr
                  key={vehicle.id}
                  className={selectedVehicle === vehicle.id ? "row-selected" : ""}
                >
                  <td>
                    <strong className="veh-id-link">{vehicle.id}</strong>
                  </td>
                  <td>
                    <span className="plate-pill">{vehicle.plate}</span>
                  </td>
                  <td>
                    <span className="driver-name">{vehicle.driver}</span>
                  </td>
                  <td>
                    <span className={`status-badge-pill status-${vehicle.statusType}`}>
                      ● {vehicle.status}
                    </span>
                  </td>
                  <td>
                    <div className="speed-heading-cell">
                      <strong className={vehicle.statusType === "moving" ? "text-teal" : ""}>
                        {vehicle.speed}
                      </strong>
                      {vehicle.heading && <small>{vehicle.heading}</small>}
                    </div>
                  </td>
                  <td>
                    <div className="ingest-time-cell">
                      <span className={vehicle.statusType === "offline" ? "text-red" : ""}>
                        {vehicle.lastPing}
                      </span>
                      {vehicle.lastTime && (
                        <small className={vehicle.statusType === "offline" ? "text-red" : ""}>
                          {vehicle.lastTime}
                        </small>
                      )}
                    </div>
                  </td>
                  <td className="coords-cell">{vehicle.coords}</td>
                  <td>
                    {vehicle.actionType === "track" ? (
                      <button
                        className="track-action-btn"
                        onClick={() => setSelectedVehicle(vehicle.id)}
                        title={`Track ${vehicle.id} on radar`}
                      >
                        <Crosshair size={13} />
                        <span>Track Now</span>
                      </button>
                    ) : (
                      <button
                        className="workorder-action-btn"
                        title="Open Maintenance Work Order"
                      >
                        <Wrench size={13} />
                        <span>Work Order</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="watchlist-footer">
          <span className="pagination-info">Showing 5 of 48 monitored vehicles</span>
          <div className="pagination-controls">
            <button className="page-btn">Previous</button>
            <button className="page-btn page-num active">1</button>
            <button className="page-btn page-num">2</button>
            <button className="page-btn page-num">3</button>
            <button className="page-btn">Next</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Cont;