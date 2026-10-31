import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState } from "../../Components/Feedback/AsyncState";
import "../../Components/Feedback/ApiData.css";
import { useAuth, useSession } from "../../auth/AuthContext";
import { FleetApiError, getSettings } from "../../services/fleetApi";

function formatSetting(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? String(value);
}

function SettingsPage() {
  const { logout } = useAuth();
  const session = useSession();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
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
    getSettings(session, controller.signal)
      .then(setSettings)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
        else if (error instanceof FleetApiError && error.status === 403) setForbiddenMessage(error.message);
        else setLoadError(error instanceof Error ? error.message : "Unable to load application settings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [retryCount, session]);

  const handleUnauthorized = async () => {
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  };

  const settingEntries = Object.entries(settings).sort(([first], [second]) => first.localeCompare(second));

  return (
    <main className="content">
      <div className="fleet-header">
        <div>
          <div className="section-label">APPLICATION PREFERENCES</div>
          <h1>Settings</h1>
          <p>Effective application and fleet configuration from the settings service.</p>
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
        <LoadingState message="Loading application settings..." />
      ) : settingEntries.length === 0 ? (
        <EmptyState
          title="No settings returned"
          message="The settings API returned an empty configuration."
          action={() => setRetryCount((count) => count + 1)}
        />
      ) : (
        <section className="api-data-panel" aria-labelledby="settings-list-title">
          <div className="api-data-panel-heading"><div><h2 id="settings-list-title">Effective settings</h2><p>{settingEntries.length.toLocaleString()} configuration values returned by the settings API</p></div></div>
          <div className="api-data-table-wrap">
            <table className="api-data-table">
              <thead><tr><th>Setting</th><th>Current value</th></tr></thead>
              <tbody>{settingEntries.map(([key, value]) => (
                <tr key={key}><td>{key}</td><td>{formatSetting(value)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default SettingsPage;
