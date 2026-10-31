import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { ErrorState, EmptyState, LoadingState, UnauthorizedState } from "../Feedback/AsyncState";
import "./../Feedback/ApiData.css";
import { useAuth, useSession } from "../../auth/AuthContext";
import { FleetApiError, getLatestLocations, listDevices, listVehicles } from "../../services/fleetApi";
import type { DeviceRecord, LatestLocation, VehicleRecord } from "../../types/fleet";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Cont() {
  const { logout } = useAuth();
  const session = useSession();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [locations, setLocations] = useState<LatestLocation[]>([]);
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
    Promise.all([
      listVehicles(session, controller.signal),
      listDevices(session, controller.signal),
      getLatestLocations(session, [], controller.signal)
    ])
      .then(([vehicleRecords, deviceRecords, latestLocations]) => {
        setVehicles(vehicleRecords);
        setDevices(deviceRecords);
        setLocations(latestLocations);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
        else if (error instanceof FleetApiError && error.status === 403) setForbiddenMessage(error.message);
        else setLoadError(error instanceof Error ? error.message : "Unable to load dashboard data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [retryCount, session]);

  const handleUnauthorized = async () => {
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  };

  const hasData = vehicles.length > 0 || devices.length > 0 || locations.length > 0;

  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">FLEET OVERVIEW</div>
          <h1>Operational Fleet Dashboard</h1>
          <p>Current fleet inventory and positions from the connected services.</p>
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
        <LoadingState message="Loading dashboard data..." />
      ) : !hasData ? (
        <EmptyState
          title="No fleet data available"
          message="The connected services returned no vehicles, devices, or current positions."
          action={() => setRetryCount((count) => count + 1)}
        />
      ) : (
        <>
          <div className="api-data-summary" aria-label="Fleet summary">
            <div className="api-data-card"><span>Vehicles</span><strong>{vehicles.length.toLocaleString()}</strong></div>
            <div className="api-data-card"><span>Devices</span><strong>{devices.length.toLocaleString()}</strong></div>
            <div className="api-data-card"><span>Vehicles with a position</span><strong>{locations.length.toLocaleString()}</strong></div>
          </div>
          <section className="api-data-panel" aria-labelledby="dashboard-locations-title">
            <div className="api-data-panel-heading">
              <div><h2 id="dashboard-locations-title">Latest reported positions</h2><p>{locations.length.toLocaleString()} position records returned by the tracking API</p></div>
            </div>
            {locations.length === 0 ? <EmptyState title="No current positions" message="The tracking service has not returned a position for any vehicle." /> : (
              <div className="api-data-table-wrap">
                <table className="api-data-table">
                  <thead><tr><th>Vehicle ID</th><th>Latitude</th><th>Longitude</th><th>Speed</th><th>Status</th><th>Recorded</th></tr></thead>
                  <tbody>
                    {locations.map((location) => (
                      <tr key={location.vehicleId}>
                        <td>{location.vehicleId}</td>
                        <td>{location.latitude}</td>
                        <td>{location.longitude}</td>
                        <td>{location.speed === null ? "—" : location.speed}</td>
                        <td>{location.status || "—"}</td>
                        <td>{formatDate(location.recordedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default Cont;
