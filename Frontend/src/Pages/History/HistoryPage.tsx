import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState } from "../../Components/Feedback/AsyncState";
import "../../Components/Feedback/ApiData.css";
import { useAuth, useSession } from "../../auth/AuthContext";
import { FleetApiError, getLocationReport } from "../../services/fleetApi";
import type { LocationReportRecord } from "../../types/fleet";

const pageSize = 100;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function HistoryPage() {
  const { logout } = useAuth();
  const session = useSession();
  const navigate = useNavigate();
  const [records, setRecords] = useState<LocationReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [forbiddenMessage, setForbiddenMessage] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError("");
    setForbiddenMessage("");
    setIsUnauthorized(false);
    getLocationReport(session, { limit: pageSize, offset: 0 }, controller.signal)
      .then((page) => {
        setRecords(page);
        setHasMore(page.length === pageSize);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
        else if (error instanceof FleetApiError && error.status === 403) setForbiddenMessage(error.message);
        else setLoadError(error instanceof Error ? error.message : "Unable to load telemetry history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [retryCount, session]);

  const handleUnauthorized = async () => {
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setMoreError("");
    try {
      const nextPage = await getLocationReport(session, { limit: pageSize, offset: records.length });
      setRecords((current) => [...current, ...nextPage]);
      setHasMore(nextPage.length === pageSize);
    } catch (error) {
      if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
      else if (error instanceof FleetApiError && error.status === 403) setForbiddenMessage(error.message);
      else setMoreError(error instanceof Error ? error.message : "Unable to load more telemetry history.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">TELEMETRY AUDIT TRAIL</div>
          <h1>Telemetry &amp; Route History</h1>
          <p>Stored location history from the reports API, ordered by recorded time.</p>
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
        <LoadingState message="Loading telemetry history..." />
      ) : records.length === 0 ? (
        <EmptyState
          title="No telemetry history"
          message="The history API returned no stored location records."
          action={() => setRetryCount((count) => count + 1)}
        />
      ) : (
        <section className="api-data-panel" aria-labelledby="history-records-title">
          <div className="api-data-panel-heading"><div><h2 id="history-records-title">Stored location records</h2><p>{records.length.toLocaleString()} records loaded from the reports API</p></div></div>
          <div className="api-data-table-wrap">
            <table className="api-data-table">
              <thead><tr><th>Recorded</th><th>Vehicle ID</th><th>Device ID</th><th>Latitude</th><th>Longitude</th><th>Speed</th><th>Heading</th><th>Altitude</th></tr></thead>
              <tbody>{records.map((record, index) => (
                <tr key={`${record.deviceId}-${record.recordedAt}-${index}`}>
                  <td>{formatDate(record.recordedAt)}</td>
                  <td>{record.vehicleId || "—"}</td>
                  <td>{record.deviceId || "—"}</td>
                  <td>{record.latitude ?? "—"}</td>
                  <td>{record.longitude ?? "—"}</td>
                  <td>{record.speed ?? "—"}</td>
                  <td>{record.heading ?? "—"}</td>
                  <td>{record.altitude ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {moreError && <ErrorState message={moreError} onRetry={() => void handleLoadMore()} />}
          {hasMore && (
            <button type="button" className="api-data-load-more" onClick={() => void handleLoadMore()} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load more history"}
            </button>
          )}
        </section>
      )}
    </main>
  );
}

export default HistoryPage;
