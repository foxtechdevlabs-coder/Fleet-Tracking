import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { FileText, RefreshCw } from "lucide-react";
import "./ReportsPage.css";
import { ErrorState, EmptyState, LoadingState, UnauthorizedState } from "../../Components/Feedback/AsyncState";
import { ReportResultsTable } from "../../Components/Reports/ReportResultsTable";
import { useAuth, useSession } from "../../auth/AuthContext";
import { FleetApiError, getLocationReport } from "../../services/fleetApi";
import type { LocationReportRecord, SpeedUnit } from "../../types/fleet";

interface ReportFilters {
  from: string;
  to: string;
  vehicleId: string;
  deviceIdentifier: string;
  timezone: string;
  speedUnit: SpeedUnit;
  limit: string;
  offset: string;
}

const initialFilters: ReportFilters = {
  from: "",
  to: "",
  vehicleId: "",
  deviceIdentifier: "",
  timezone: "UTC",
  speedUnit: "km/h",
  limit: "1000",
  offset: "0"
};

function toIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function ReportsPage() {
  const { logout } = useAuth();
  const session = useSession();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(initialFilters);
  const [rows, setRows] = useState<LocationReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const filterKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);

  useEffect(() => {
    const controller = new AbortController();
    const requestFilters = {
      ...appliedFilters,
      from: toIso(appliedFilters.from),
      to: toIso(appliedFilters.to)
    };
    setIsLoading(true);
    setError("");
    setIsUnauthorized(false);
    getLocationReport(session, requestFilters, controller.signal)
      .then(setRows)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof FleetApiError && requestError.status === 401) setIsUnauthorized(true);
        else setError(requestError instanceof Error ? requestError.message : "Unable to generate the location report.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [filterKey, retryCount, session, appliedFilters]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
      setError("The start time must be before or equal to the end time.");
      return;
    }
    setError("");
    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  };

  const handleUnauthorized = async () => {
    try { await logout(); } finally { window.location.assign("/login"); }
  };

  return (
    <main className="content">
      <div className="reports-header">
        <div>
          <div className="section-label">FLEET ANALYTICS</div>
          <h1>Location Reports</h1>
          <p>Generate reports from stored vehicle location history.</p>
        </div>
        <button type="button" className="report-action" onClick={() => setRetryCount((count) => count + 1)} disabled={isLoading}><RefreshCw size={14} /> Refresh</button>
      </div>

      {isUnauthorized ? <UnauthorizedState action={handleUnauthorized} /> : (
        <>
          <section className="report-panel" aria-labelledby="report-filters-title">
            <div className="report-panel-heading"><div><div className="section-label">REPORT FILTERS</div><h2 id="report-filters-title">Location history</h2></div><FileText size={18} className="report-icon" /></div>
            <form className="report-filters" onSubmit={handleSubmit}>
              <ReportField label="From" name="from" type="datetime-local" value={filters.from} onChange={handleChange} />
              <ReportField label="To" name="to" type="datetime-local" value={filters.to} onChange={handleChange} />
              <ReportField label="Vehicle ID" name="vehicleId" value={filters.vehicleId} onChange={handleChange} placeholder="UUID" />
              <ReportField label="Device identifier" name="deviceIdentifier" value={filters.deviceIdentifier} onChange={handleChange} placeholder="GPS-001" />
              <label className="report-field"><span>Timezone</span><select name="timezone" value={filters.timezone} onChange={handleChange}><option value="UTC">UTC</option><option value="Asia/Kolkata">Asia/Kolkata</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select></label>
              <label className="report-field"><span>Speed unit</span><select name="speedUnit" value={filters.speedUnit} onChange={handleChange}><option value="km/h">km/h</option><option value="mph">mph</option></select></label>
              <div className="report-filter-actions"><button type="submit" className="report-primary">Generate report</button><button type="button" className="report-secondary" onClick={handleReset}>Reset</button></div>
            </form>
            {error && <ErrorState message={error} onRetry={() => setRetryCount((count) => count + 1)} />}
          </section>

          <section className="report-panel report-results" aria-labelledby="report-results-title">
            <div className="report-panel-heading"><div><div className="section-label">REPORT RESULTS</div><h2 id="report-results-title">Location records</h2></div><div className="report-result-actions"><span>{rows.length} records</span></div></div>
            {isLoading ? <LoadingState message="Generating location report..." /> : rows.length === 0 ? <EmptyState title="No matching location records" message="Try a wider time range or remove one of the optional filters." /> : (
              <ReportResultsTable
                records={rows}
                filter={appliedFilters}
                timeZone={appliedFilters.timezone}
                speedUnit={appliedFilters.speedUnit}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}

interface ReportFieldProps {
  label: string;
  name: keyof ReportFilters;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}

function ReportField({ label, name, value, onChange, type = "text", placeholder = "" }: ReportFieldProps) {
  return <label className="report-field"><span>{label}</span><input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} /></label>;
}

export default ReportsPage;
