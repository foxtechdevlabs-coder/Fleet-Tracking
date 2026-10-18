import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileBarChart, Shield } from 'lucide-react';
import { fetchDevices, fetchReportVehicles, fetchTrackingReport, ReportApiUnavailableError } from '../services/telemetryApi';
import type { DeviceSummary, ReportVehicleOption, TrackingReportFilter, TrackingReportRecord } from '../types/telemetry';
import { ReportFilterCard } from '../components/reports/ReportFilterCard';
import { ReportInitialState } from '../components/reports/ReportInitialState';
import { ReportLoadingState } from '../components/reports/ReportLoadingState';
import { ReportEmptyState } from '../components/reports/ReportEmptyState';
import { ReportErrorState } from '../components/reports/ReportErrorState';
import { ReportResultsTable } from '../components/reports/ReportResultsTable';

type ReportQueryState = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'unavailable';

export const ReportsPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<ReportVehicleOption[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [queryState, setQueryState] = useState<ReportQueryState>('idle');
  const [records, setRecords] = useState<TrackingReportRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TrackingReportFilter | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Abort controller ref to cancel in-flight queries if filter changes
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch actual registered filter options from the paginated backend resources.
  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([fetchReportVehicles(), fetchDevices()]).then(([vehicleResult, deviceResult]) => {
      if (!isMounted) return;
      if (vehicleResult.status === 'fulfilled') setVehicles(vehicleResult.value);
      if (deviceResult.status === 'fulfilled') setDevices(deviceResult.value);
      const failures = [vehicleResult, deviceResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : 'A filter option list could not be loaded.');
      setCatalogError(failures.length ? `Filter options are incomplete. ${failures.join(' ')}` : null);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Primary report query handler
  const handleGenerateReport = useCallback(async (filter: TrackingReportFilter, isRetry = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setActiveFilter(filter);
    // Show the loading skeleton both on fresh queries and retries so the user
    // always gets visual feedback that a new request is in-flight.
    setQueryState('loading');
    if (isRetry) {
      setIsRetrying(true);
    }
    setRecords([]);
    setErrorMessage(null);

    try {
      const data = await fetchTrackingReport(filter, controller.signal);

      // STRICT REQUIREMENT: No hardcoded dummy data.
      // Faithfully reflect the API results.
      if (!data || data.length === 0) {
        setRecords([]);
        setQueryState('empty');
      } else {
        setRecords(data);
        setQueryState('success');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to query telemetry records from server.';
      setRecords([]);
      setErrorMessage(msg);
      setQueryState(err instanceof ReportApiUnavailableError ? 'unavailable' : 'error');
    } finally {
      setIsRetrying(false);
    }
  }, []);

  // Retry query with current filter
  const handleRetry = useCallback(() => {
    if (activeFilter) {
      handleGenerateReport(activeFilter, true);
    }
  }, [activeFilter, handleGenerateReport]);

  const handleFiltersChange = useCallback(() => {
    abortControllerRef.current?.abort();
    setActiveFilter(null);
    setRecords([]);
    setErrorMessage(null);
    setIsRetrying(false);
    setQueryState('idle');
  }, []);

  // Reset back to initial idle state
  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setActiveFilter(null);
    setRecords([]);
    setErrorMessage(null);
    setQueryState('idle');
  }, []);

  return (
    <div className="reports-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="header-tag">
            <FileBarChart size={13} />
            <span>FLEET OPERATIONS &gt; REPORTS</span>
          </div>
          <h1 className="page-title">Telemetry Tracking Reports</h1>
          <p className="page-subtitle">
            Review historical tracking and movement records from stored telemetry data.
          </p>
        </div>
        <div className="report-capabilities" aria-label="Report export availability">
          <span className="report-capability available"><Shield size={13} /> Excel &amp; CSV available</span>
          <span className="report-capability unavailable"><Shield size={13} /> PDF unavailable</span>
        </div>
      </div>

      {/* Filter Controls & Form */}
      <ReportFilterCard
        vehicles={vehicles}
        devices={devices}
        isLoading={queryState === 'loading'}
        onGenerateReport={(filter) => handleGenerateReport(filter, false)}
        onFiltersChange={handleFiltersChange}
        onReset={handleReset}
      />

      {catalogError && (
        <div className="report-catalog-warning" role="status">
          <Shield size={16} />
          <span>{catalogError}</span>
        </div>
      )}

      {/* When data is not yet generated or records is 0, keep export buttons visible in toolbar in disabled state */}
      {queryState !== 'success' && (
        <div
          className="reports-export-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '4px 0',
          }}
          aria-label="Report Export Actions"
        >
          <button
            type="button"
            className="export-btn"
            disabled
            title="Generate a report to enable export"
          >
            <span>Export CSV (.csv)</span>
          </button>
          <button
            type="button"
            className="export-btn"
            disabled
            title="Generate a report to enable export"
          >
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      )}

      {/* State Transitions Container */}
      {queryState === 'idle' && <ReportInitialState />}

      {queryState === 'loading' && <ReportLoadingState rows={7} />}

      {queryState === 'empty' && <ReportEmptyState onResetFilters={handleReset} />}

      {(queryState === 'error' || queryState === 'unavailable') && (
        <ReportErrorState
          error={errorMessage || ''}
          onRetry={handleRetry}
          isRetrying={isRetrying}
          isUnavailable={queryState === 'unavailable'}
        />
      )}

      {queryState === 'success' && (
        <ReportResultsTable records={records} filter={activeFilter} />
      )}
    </div>
  );
};
