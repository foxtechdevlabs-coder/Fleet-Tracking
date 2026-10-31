import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState } from "../../Components/Feedback/AsyncState";
import "./../../Components/Feedback/ApiData.css";
import "./FleetPage.css";
import { useAuth, useSession } from "../../auth/AuthContext";
import { FleetApiError, listDevices, listVehicles } from "../../services/fleetApi";
import type { DeviceRecord, VehicleRecord } from "../../types/fleet";

function FleetPage() {
  const { logout } = useAuth();
  const session = useSession();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [forbiddenMessage, setForbiddenMessage] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError("");
    setForbiddenMessage("");
    setIsUnauthorized(false);
    Promise.all([listDevices(session, controller.signal), listVehicles(session, controller.signal)])
      .then(([deviceRecords, vehicleRecords]) => {
        setDevices(deviceRecords);
        setVehicles(vehicleRecords);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
        else if (error instanceof FleetApiError && error.status === 403) setForbiddenMessage(error.message);
        else setLoadError(error instanceof Error ? error.message : "Unable to load fleet records.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [retryCount, session]);

  const handleUnauthorized = async () => {
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  };

  const assignedDevices = devices.filter((device) => device.vehicleId);

  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">ASSET & INVENTORY REGISTRY</div>
          <h1>Fleet Asset Management</h1>
          <p>Registered vehicles and assigned devices.</p>
        </div>
        <button type="button" className="api-data-refresh" onClick={() => setRetryCount((count) => count + 1)} disabled={isLoading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {isUnauthorized ? <UnauthorizedState action={handleUnauthorized} /> : forbiddenMessage ? (
        <UnauthorizedState message={forbiddenMessage} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => setRetryCount((count) => count + 1)} />
      ) : isLoading ? (
        <LoadingState message="Loading fleet records..." />
      ) : vehicles.length === 0 && devices.length === 0 ? (
        <EmptyState
          title="No fleet records"
          message="The vehicle and device APIs returned no registered records."
          action={() => setRetryCount((count) => count + 1)}
        />
      ) : (
        <>
          <div className="api-data-summary" aria-label="Fleet inventory">
            <div className="api-data-card"><span>Vehicles</span><strong>{vehicles.length.toLocaleString()}</strong></div>
            <div className="api-data-card"><span>Devices</span><strong>{devices.length.toLocaleString()}</strong></div>
            <div className="api-data-card"><span>Assigned devices</span><strong>{assignedDevices.length.toLocaleString()}</strong></div>
          </div>
          <section className="api-data-panel" aria-labelledby="fleet-vehicles-title">
            <div className="api-data-panel-heading"><div><h2 id="fleet-vehicles-title">Vehicles</h2><p>{vehicles.length.toLocaleString()} records returned by the vehicle API</p></div></div>
            {vehicles.length === 0 ? <EmptyState title="No vehicles registered" /> : (
              <div className="api-data-table-wrap">
                <table className="api-data-table">
                  <thead><tr><th>Registration</th><th>Make / model</th><th>Year</th><th>Status</th><th>Vehicle ID</th></tr></thead>
                  <tbody>{vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>{vehicle.plateNumber}</td>
                      <td>{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}</td>
                      <td>{vehicle.year ?? "—"}</td>
                      <td>{vehicle.status || "—"}</td>
                      <td>{vehicle.id}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <section className="api-data-panel" aria-labelledby="fleet-devices-title">
            <div className="api-data-panel-heading"><div><h2 id="fleet-devices-title">Devices</h2><p>{devices.length.toLocaleString()} records returned by the device API</p></div></div>
            {devices.length === 0 ? <EmptyState title="No devices registered" /> : (
              <div className="api-data-table-wrap">
                <table className="api-data-table">
                  <thead><tr><th>Identifier</th><th>Status</th><th>Assigned vehicle ID</th><th>Device ID</th></tr></thead>
                  <tbody>{devices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.identifier}</td>
                      <td>{device.status || "—"}</td>
                      <td>{device.vehicleId || "Unassigned"}</td>
                      <td>{device.id}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default FleetPage;
