import React, { useState } from "react";
import { Search, Plus, Wifi } from "lucide-react";
import "./FleetPage.css";

const fleetList = [
  {
    id: "VH-001",
    plate: "TN 74 AB 1234",
    model: "BharatBenz 2823R",
    driver: "R. Saravanan",
    type: "Heavy Hauler",
    device: "TELTONIKA-FMB120",
    status: "active",
    fuel: "84%",
    odometer: "48,210 km"
  },
  {
    id: "VH-002",
    plate: "TN 75 CD 5678",
    model: "Tata Prima 4028.S",
    driver: "K. Anbarasan",
    type: "Tractor Trailer",
    device: "TELTONIKA-FMB920",
    status: "idle",
    fuel: "62%",
    odometer: "32,840 km"
  },
  {
    id: "VH-003",
    plate: "TN 11 DA 8821",
    model: "Ashok Leyland 1920",
    driver: "S. Murugan",
    type: "Medium Cargo",
    device: "TELTONIKA-FMB120",
    status: "maintenance",
    fuel: "45%",
    odometer: "91,120 km"
  },
  {
    id: "VH-004",
    plate: "TN 09 BK 4432",
    model: "Mahindra Blazo X",
    driver: "P. Muthuvel",
    type: "Multi-Axle",
    device: "QUECLINK-GL300",
    status: "offline",
    fuel: "18%",
    odometer: "64,700 km"
  },
  {
    id: "VH-012",
    plate: "TN 22 EX 8809",
    model: "Eicher Pro 3019",
    driver: "D. Senthil Kumar",
    type: "Container Carrier",
    device: "TELTONIKA-FMB120",
    status: "active",
    fuel: "92%",
    odometer: "19,530 km"
  }
];

function FleetPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = fleetList.filter((item) => {
    const matchStatus = filter === "all" || item.status === filter;
    const matchSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.plate.toLowerCase().includes(search.toLowerCase()) ||
      item.driver.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">ASSET & INVENTORY REGISTRY</div>
          <h1>Fleet Asset Management</h1>
          <p>Registered transport vehicles, telematics unit bonds & hardware diagnostic status</p>
        </div>

        <div className="fleet-header-actions">
          <button className="add-fleet-btn">
            <Plus size={14} />
            <span>Register New Vehicle</span>
          </button>
        </div>
      </div>

      <div className="fleet-filter-bar">
        <div className="fleet-search-wrap">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search by plate, vehicle ID, driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="status-filter-pills">
          <button
            className={`pill-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({fleetList.length})
          </button>
          <button
            className={`pill-btn ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active (2)
          </button>
          <button
            className={`pill-btn ${filter === "idle" ? "active" : ""}`}
            onClick={() => setFilter("idle")}
          >
            Idle (1)
          </button>
          <button
            className={`pill-btn ${filter === "maintenance" ? "active" : ""}`}
            onClick={() => setFilter("maintenance")}
          >
            Maintenance (1)
          </button>
          <button
            className={`pill-btn ${filter === "offline" ? "active" : ""}`}
            onClick={() => setFilter("offline")}
          >
            Offline (1)
          </button>
        </div>
      </div>

      <div className="fleet-grid">
        {filtered.map((item) => (
          <div key={item.id} className="fleet-card">
            <div className="fleet-card-header">
              <div>
                <span className="fleet-card-id">{item.id}</span>
                <h3 className="fleet-card-plate">{item.plate}</h3>
              </div>
              <span className={`status-tag status-${item.status}`}>
                {item.status.toUpperCase()}
              </span>
            </div>

            <div className="fleet-card-model">{item.model} • {item.type}</div>

            <div className="fleet-card-details">
              <div className="detail-row">
                <span className="detail-label">Assigned Driver</span>
                <span className="detail-value">{item.driver}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Telemetry Unit</span>
                <span className="detail-value mono">{item.device}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Fuel Level</span>
                <span className="detail-value">{item.fuel}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Odometer</span>
                <span className="detail-value mono">{item.odometer}</span>
              </div>
            </div>

            <div className="fleet-card-footer">
              <span className="gps-indicator">
                <Wifi size={12} />
                <span>Cellular Ingest Active</span>
              </span>
              <button className="view-details-btn">Telemetry Specs</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default FleetPage;
