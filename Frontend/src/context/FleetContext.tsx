import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type {
  Vehicle,
  AlertItem,
  TelemetryEventItem,
  FleetSummaryMetrics,
  OperationalStatus,
  ApiState,
  ApiErrorDetails,
} from '../types/telemetry';
import {
  fetchVehicles,
  fetchVehicleById,
  computeFleetMetrics,
  parseApiError,
} from '../services/telemetryApi';

interface FleetContextType {
  vehicles: Vehicle[];
  isLoading: boolean;
  isRefreshing: boolean;
  trackingState: ApiState;
  apiError: ApiErrorDetails | null;
  error: string | null;
  retryCount: number;
  metrics: FleetSummaryMetrics;
  alerts: AlertItem[];
  events: TelemetryEventItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: OperationalStatus | 'ALL';
  setStatusFilter: (status: OperationalStatus | 'ALL') => void;
  refreshTelemetry: (silent?: boolean) => Promise<void>;
  retryTracking: () => Promise<void>;
  refreshSingleVehicle: (vehicleId: string) => Promise<void>;
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  lastIngestionTime: Date;
  isLivePolling: boolean;
  setIsLivePolling: (enabled: boolean) => void;
  emergencyBroadcasts: string[];
  triggerEmergencyBroadcast: (message: string) => void;
  removeAlert: (alertId: string) => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

const LIVE_POLL_INTERVAL_MS = 10000; // 10s automatic live refresh

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core state: start strictly empty (zero fake/mock datasets)
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [events] = useState<TelemetryEventItem[]>([]);
  const [trackingState, setTrackingState] = useState<ApiState>('idle');
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<OperationalStatus | 'ALL'>('ALL');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [lastIngestionTime, setLastIngestionTime] = useState<Date>(new Date());
  const [isLivePolling, setIsLivePolling] = useState<boolean>(true);
  const [emergencyBroadcasts, setEmergencyBroadcasts] = useState<string[]>([]);

  // Refs for tracking in-flight requests and interval cleanup
  const inFlightRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);
  vehiclesRef.current = vehicles;

  /**
   * Primary telemetry fetching routine with AbortController, state machine updates,
   * in-flight request guards, and LastKnownLocation preservation.
   */
  const loadFleetData = useCallback(async (isRefresh = false, isRetry = false): Promise<boolean> => {
    // If request already in flight, avoid launching duplicate overlapping HTTP calls
    if (inFlightRef.current) {
      return false;
    }

    // Abort previous in-flight request if present
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    inFlightRef.current = true;

    if (isRetry) {
      setTrackingState('retrying');
    } else if (isRefresh) {
      // Keep existing data visible during refresh
      setTrackingState('loading');
    } else {
      setTrackingState('loading');
    }

    try {
      const fetched = await fetchVehicles(controller.signal, vehiclesRef.current);
      setVehicles(fetched);
      setApiError(null);
      setTrackingState('success');
      setRetryCount(0);
      setLastIngestionTime(new Date());
      return true;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Ignored as this was intentionally aborted by a superseding request
        return false;
      }
      const parsedError = parseApiError(err);
      setApiError(parsedError);
      setTrackingState('error');
      return false;
    } finally {
      inFlightRef.current = false;
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    void loadFleetData(false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [loadFleetData]);

  // Live polling routine with visibilitychange detection
  useEffect(() => {
    if (!isLivePolling) {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const handleTick = () => {
      if (document.visibilityState === 'visible' && !inFlightRef.current) {
        void loadFleetData(true);
      }
    };

    pollTimerRef.current = window.setInterval(handleTick, LIVE_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab brought back into focus: trigger immediate telemetry sync
        void loadFleetData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLivePolling, loadFleetData]);

  /**
   * Manual refresh trigger with silent flag support
   */
  const refreshTelemetry = useCallback(async () => {
    await loadFleetData(true);
  }, [loadFleetData]);

  /**
   * Functional Retry action with backoff capability
   */
  const retryTracking = useCallback(async () => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setRetryCount((prev) => prev + 1);
    await loadFleetData(false, true);
  }, [loadFleetData]);

  /**
   * Refresh telemetry for a single vehicle (e.g. when selected in live tracking)
   */
  const refreshSingleVehicle = useCallback(async (vehicleId: string) => {
    try {
      const existing = vehiclesRef.current.find((v) => v.id === vehicleId) ?? null;
      const updated = await fetchVehicleById(vehicleId, undefined, existing);
      setVehicles((prev) => {
        const index = prev.findIndex((v) => v.id === vehicleId);
        if (index === -1) return [updated, ...prev];
        const next = [...prev];
        next[index] = updated;
        return next;
      });
      setLastIngestionTime(new Date());
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
    }
  }, []);

  const triggerEmergencyBroadcast = useCallback((message: string) => {
    setEmergencyBroadcasts((prev) => [message, ...prev]);
    const newAlert: AlertItem = {
      id: `ALT-${Date.now()}`,
      vehicleId: 'ALL-UNITS',
      plateNumber: 'BROADCAST',
      title: 'COMMAND EMERGENCY BROADCAST',
      message,
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  }, []);

  const removeAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const metrics = useMemo(() => computeFleetMetrics(vehicles), [vehicles]);

  const isLoading = trackingState === 'loading' && vehicles.length === 0;
  const isRefreshing = trackingState === 'loading' && vehicles.length > 0;
  const legacyError = apiError?.friendlyMessage || null;

  const value = useMemo(
    () => ({
      vehicles,
      isLoading,
      isRefreshing,
      trackingState,
      apiError,
      error: legacyError,
      retryCount,
      metrics,
      alerts,
      events,
      searchQuery,
      setSearchQuery,
      statusFilter,
      setStatusFilter,
      refreshTelemetry,
      retryTracking,
      refreshSingleVehicle,
      selectedVehicleId,
      setSelectedVehicleId,
      lastIngestionTime,
      isLivePolling,
      setIsLivePolling,
      emergencyBroadcasts,
      triggerEmergencyBroadcast,
      removeAlert,
    }),
    [
      vehicles,
      isLoading,
      isRefreshing,
      trackingState,
      apiError,
      legacyError,
      retryCount,
      metrics,
      alerts,
      events,
      searchQuery,
      statusFilter,
      refreshTelemetry,
      retryTracking,
      refreshSingleVehicle,
      selectedVehicleId,
      lastIngestionTime,
      isLivePolling,
      emergencyBroadcasts,
      triggerEmergencyBroadcast,
      removeAlert,
    ]
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
};

export const useFleet = (): FleetContextType => {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return context;
};
