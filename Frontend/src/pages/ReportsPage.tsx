import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield } from 'lucide-react';
import { useFleet } from '../context/FleetContext';
import { fetchDevices, fetchTrackingReport } from '../services/telemetryApi';
import type { DeviceSummary, TrackingReportFilter, TrackingReportRecord } from '../types/telemetry';
import { ReportFilterCard } from '../components/reports/ReportFilterCard';
import { ReportInitialState } from '../components/reports/ReportInitialState';
import { ReportLoadingState } from '../components/reports/ReportLoadingState';
import { ReportEmptyState } from '../components/reports/ReportEmptyState';
import { ReportErrorState } from '../components/reports/ReportErrorState';
import { ReportResultsTable } from '../components/reports/ReportResultsTable';

type ReportQueryState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export const ReportsPage: React.FC = () => {
  const { vehicles } = useFleet();
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [queryState, setQueryState] = useState<ReportQueryState>('idle');
  const [records, setRecords] = useState<TrackingReportRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TrackingReportFilter | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Abort controller ref to cancel in-flight queries if filter changes
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch registered devices for the filter selector
  useEffect(() => {
    let isMounted = true;
    const loadDevices = async () => {
      try {
        const fetchedDevices = await fetchDevices();
        if (isMounted) {
          setDevices(fetchedDevices);
        }
      } catch {
        // Fall back gracefully if devices endpoint isn't ready
      }
    };
    loadDevices();
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
    if (isRetry) {
      setIsRetrying(true);
    } else {
      setQueryState('loading');
    }
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
      setErrorMessage(msg);
      setQueryState('error');
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
            <Shield size={13} />
            <span>EXECUTIVE AUDIT &gt; TRACKING REPORTS</span>
          </div>
          <h1 className="page-title">Fleet Tracking Reports &amp; Sensor Logs</h1>
          <p className="page-subtitle">
            Query historical telemetry waypoints, GPS position trails, and speed readings across fleet assets.
          </p>
        </div>
      </div>

      {/* Filter Controls & Form */}
      <ReportFilterCard
        vehicles={vehicles}
        devices={devices}
        isLoading={queryState === 'loading'}
        onGenerateReport={(filter) => handleGenerateReport(filter, false)}
        onReset={handleReset}
      />

      {/* State Transitions Container */}
      {queryState === 'idle' && <ReportInitialState />}

      {queryState === 'loading' && <ReportLoadingState rows={7} />}

      {queryState === 'empty' && <ReportEmptyState onResetFilters={handleReset} />}

      {queryState === 'error' && (
        <ReportErrorState
          error={errorMessage || ''}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {queryState === 'success' && <ReportResultsTable records={records} />}
    </div>
  );
};
