import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Activity, MapPin, RefreshCw, Send, Wifi, WifiOff } from "lucide-react";
import "./LiveTrackingPage.css";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState
} from "../../Components/Feedback/AsyncState";
import { MapViewport } from "../../Components/Map/MapViewport";
import { useAuth, useSession } from "../../auth/AuthContext";
import { FleetApiError, getLatestLocations, ingestLocation } from "../../services/fleetApi";
import type { IngestPayload, LatestLocation } from "../../types/fleet";

interface IngestForm {
  deviceIdentifier: string;
  recordedAt: string;
  latitude: string;
  longitude: string;
  speed: string;
  heading: string;
  altitude: string;
}

const optionalIngestFields = ["speed", "heading", "altitude"] as const;

const initialIngestForm: IngestForm = {
  deviceIdentifier: "",
  recordedAt: "",
  latitude: "",
  longitude: "",
  speed: "",
  heading: "",
  altitude: ""
};

function display(value: unknown, suffix = "") {
  return value === null || value === undefined || value === "" ? "-" : `${value}${suffix}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : `${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date)} UTC`;
}

function LiveTrackingPage() {
  const { logout } = useAuth();
  const session = useSession();
  const [locations, setLocations] = useState<LatestLocation[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [ingestForm, setIngestForm] = useState<IngestForm>(initialIngestForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [ingestError, setIngestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const vehicleIds = activeFilter.split(",").map((id) => id.trim()).filter(Boolean);
    setIsLoading(true);
    setLoadError("");
    setIsUnauthorized(false);

    getLatestLocations(session, vehicleIds, controller.signal)
      .then(setLocations)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
        else setLoadError(error instanceof Error ? error.message : "Unable to load live positions.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [activeFilter, retryCount, session]);

  const handleUnauthorized = async () => {
    try { await logout(); } finally { window.location.assign("/login"); }
  };

  const handleIngestChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setIngestForm((current) => ({ ...current, [name]: value }));
    setIngestError("");
    setSuccessMessage("");
  };

  const handleRefresh = () => {
    setSuccessMessage("");
    setRetryCount((count) => count + 1);
  };

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ids = vehicleFilter.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length > 500) {
      setLoadError("You can filter at most 500 vehicle IDs.");
      return;
    }
    setLoadError("");
    setActiveFilter(ids.join(","));
  };

  const validateIngest = () => {
    const latitude = Number(ingestForm.latitude);
    const longitude = Number(ingestForm.longitude);
    if (!ingestForm.deviceIdentifier.trim()) return "Device identifier is required.";
    if (!ingestForm.recordedAt) return "Recorded time is required.";
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Latitude must be between -90 and 90.";
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Longitude must be between -180 and 180.";
    if (ingestForm.speed !== "" && (!Number.isFinite(Number(ingestForm.speed)) || Number(ingestForm.speed) < 0)) return "Speed must be a non-negative number.";
    if (ingestForm.heading !== "" && (!Number.isFinite(Number(ingestForm.heading)) || Number(ingestForm.heading) < 0 || Number(ingestForm.heading) > 360)) return "Heading must be between 0 and 360.";
    if (ingestForm.altitude !== "" && !Number.isFinite(Number(ingestForm.altitude))) return "Altitude must be a number.";
    return "";
  };

  const handleIngest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateIngest();
    if (isIngesting || validationError) {
      setIngestError(validationError);
      return;
    }
    setIsIngesting(true);
    setIngestError("");
    setSuccessMessage("");
    const payload: IngestPayload = {
      deviceIdentifier: ingestForm.deviceIdentifier.trim(),
      recordedAt: new Date(ingestForm.recordedAt).toISOString(),
      latitude: Number(ingestForm.latitude),
      longitude: Number(ingestForm.longitude)
    };
    optionalIngestFields.forEach((field) => {
      if (ingestForm[field] !== "") payload[field] = Number(ingestForm[field]);
    });
    try {
      await ingestLocation(session, payload);
      setIngestForm(initialIngestForm);
      setSuccessMessage("Location accepted. Live positions are being refreshed.");
      setRetryCount((count) => count + 1);
    } catch (error) {
      if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
      else setIngestError(error instanceof Error ? error.message : "Location ingest failed. Please try again.");
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <main className="content">
      <div className="tracking-header">
        <div>
          <div className="section-label">LIVE FLEET MONITORING</div>
          <h1>Live Tracking</h1>
          <p>Current vehicle locations from the tracking service.</p>
        </div>
        <button type="button" className="tracking-refresh-btn" onClick={handleRefresh} disabled={isLoading}><RefreshCw size={14} /> Refresh</button>
      </div>

      {isUnauthorized ? <UnauthorizedState action={handleUnauthorized} /> : (
        <>
          {successMessage && <div className="tracking-success" role="status"><Activity size={15} />{successMessage}</div>}
          {loadError && <ErrorState message={loadError} onRetry={handleRefresh} />}

          <section className="tracking-map" aria-label="Live fleet map">
            <MapViewport locations={locations} isLoading={isLoading} error={loadError} />
          </section>

          <section className="tracking-panel" aria-labelledby="latest-title">
            <div className="tracking-panel-heading"><div><div className="section-label">LATEST POSITIONS</div><h2 id="latest-title">Vehicle locations</h2></div><span className={`tracking-status-badge${loadError ? " tracking-status-error" : ""}`}>{loadError ? <WifiOff size={13} /> : <Wifi size={13} />} {loadError ? "API unavailable" : isLoading ? "Loading..." : "API connected"}</span></div>
            <form className="tracking-filter" onSubmit={handleFilterSubmit}>
              <label htmlFor="vehicleFilter">Vehicle IDs</label>
              <input id="vehicleFilter" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} placeholder="Optional comma-separated UUIDs" />
              <button type="submit">Load selection</button>
              <span>Leave empty to load all available positions.</span>
            </form>
            {isLoading ? <LoadingState message="Loading current vehicle positions..." /> : locations.length === 0 ? <EmptyState title="No live positions available" message="The tracking service has no stored position for the selected vehicles." /> : (
              <div className="tracking-table-wrap"><table className="tracking-table"><thead><tr><th>Vehicle ID</th><th>Latitude</th><th>Longitude</th><th>Speed</th><th>Heading</th><th>Recorded</th></tr></thead><tbody>{locations.map((location) => <tr key={`${location.vehicleId}-${location.recordedAt}`}><td><strong>{location.vehicleId}</strong></td><td>{display(location.latitude)}</td><td>{display(location.longitude)}</td><td>{display(location.speed, " km/h")}</td><td>{display(location.heading, "°")}</td><td>{formatDate(location.recordedAt)}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <section className="tracking-panel ingest-panel" aria-labelledby="ingest-title">
            <div className="tracking-panel-heading"><div><div className="section-label">NORMALIZED INGEST</div><h2 id="ingest-title">Store a device location</h2></div><MapPin size={18} className="tracking-icon" /></div>
            <p className="tracking-help">Submit a real device reading. The backend resolves the registered vehicle from the device identifier.</p>
            {ingestError && <ErrorState message={ingestError} />}
            <form className="ingest-form" onSubmit={handleIngest} noValidate>
              <Field label="Device identifier" name="deviceIdentifier" value={ingestForm.deviceIdentifier} onChange={handleIngestChange} placeholder="GPS-001" />
              <Field label="Recorded time" name="recordedAt" type="datetime-local" value={ingestForm.recordedAt} onChange={handleIngestChange} />
              <Field label="Latitude" name="latitude" type="number" value={ingestForm.latitude} onChange={handleIngestChange} placeholder="51.5072" step="any" />
              <Field label="Longitude" name="longitude" type="number" value={ingestForm.longitude} onChange={handleIngestChange} placeholder="-0.1276" step="any" />
              <Field label="Speed (optional)" name="speed" type="number" value={ingestForm.speed} onChange={handleIngestChange} step="any" />
              <Field label="Heading (optional)" name="heading" type="number" value={ingestForm.heading} onChange={handleIngestChange} step="any" />
              <Field label="Altitude (optional)" name="altitude" type="number" value={ingestForm.altitude} onChange={handleIngestChange} step="any" />
              <div className="ingest-submit"><button type="submit" className="save-provision-btn" disabled={isIngesting}>{isIngesting ? <span className="btn-spinner" /> : <Send size={15} />} Submit reading</button></div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

interface FieldProps {
  label: string;
  name: keyof IngestForm;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  step?: string;
}

function Field({ label, name, value, onChange, type = "text", placeholder = "", step }: FieldProps) {
  return <label className="tracking-field" htmlFor={name}><span>{label}</span><input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} step={step} /></label>;
}

export default LiveTrackingPage;
