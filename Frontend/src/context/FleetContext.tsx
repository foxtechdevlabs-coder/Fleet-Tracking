import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Vehicle, AlertItem, TelemetryEventItem, FleetSummaryMetrics, OperationalStatus } from '../types/telemetry';
import { fetchVehicles, fetchCriticalAlerts, fetchTelemetryEvents, computeFleetMetrics } from '../services/telemetryApi';

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
  emergencyBroadcasts: string[];
  triggerEmergencyBroadcast: (message: string) => void;
  removeAlert: (alertId: string) => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

const LIVE_POLL_INTERVAL_MS = 10000; // 10s automatic live refresh

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL CONSTRAINT: Start with empty state — no dummy mock array hardcoded
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
  const [emergencyBroadcasts, setEmergencyBroadcasts] = useState<string[]>([]);

  // Initial load from backend API
  const loadFleetData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setTrackingState('loading');
    }

    try {
      const [fetchedVehicles, fetchedAlerts, fetchedEvents] = await Promise.all([
        fetchVehicles(),
        fetchCriticalAlerts(),
        fetchTelemetryEvents(),
      ]);

      // If backend returned vehicles, update; otherwise remains empty list
      if (fetchedVehicles.length > 0) {
        setVehicles(fetchedVehicles);
      }
      setAlerts(fetchedAlerts);
      setEvents(fetchedEvents);
      setLastIngestionTime(new Date());
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
      setIsLoading(false);
      setIsRefreshing(false);
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

  // Ability for operators to bond / register a new device & vehicle on the fly
  const addVehicle = useCallback((data: Partial<Vehicle> & { plateNumber: string; make: string; model: string }): Vehicle => {
    const newId = data.id || `VH-${String(vehicles.length + 1).padStart(3, '0')}`;
    const newVehicle: Vehicle = {
      id: newId,
      plateNumber: data.plateNumber.toUpperCase(),
      make: data.make,
      model: data.model,
      year: data.year || new Date().getFullYear(),
      driverName: data.driverName || 'Unassigned',
      driverPhone: data.driverPhone,
      deviceId: data.deviceId || `DEV-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'active',
      operationalStatus: data.operationalStatus || 'MOVING',
      telemetry: {
        latitude: 12.9716 + (Math.random() - 0.5) * 0.05,
        longitude: 77.5946 + (Math.random() - 0.5) * 0.05,
        speed: data.operationalStatus === 'STOPPED' ? 0 : 45,
        heading: 90,
        ignition: data.operationalStatus !== 'OFFLINE',
        batteryVoltage: 13.8,
        fuelPercentage: 82,
        odometerKm: 14250,
        recordedAt: new Date().toISOString(),
        ingestedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setVehicles(prev => [newVehicle, ...prev]);

    // Also register an ingestion event
    const eventItem: TelemetryEventItem = {
      id: `EV-${Date.now()}`,
      vehicleId: newId,
      deviceId: newVehicle.deviceId,
      eventType: 'device_bonded',
      summary: `Bonded new GPS unit ${newVehicle.deviceId} to ${newVehicle.plateNumber}`,
      recordedAt: new Date().toISOString(),
      ingestedAt: new Date().toISOString(),
    };
    setEvents(prev => [eventItem, ...prev]);
    setLastIngestionTime(new Date());

    return newVehicle;
  }, [vehicles.length]);

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
