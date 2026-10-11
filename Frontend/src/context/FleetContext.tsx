import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Vehicle, AlertItem, TelemetryEventItem, FleetSummaryMetrics, OperationalStatus } from '../types/telemetry';
import { fetchVehicles, computeFleetMetrics } from '../services/telemetryApi';

interface FleetContextType {
  vehicles: Vehicle[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  metrics: FleetSummaryMetrics;
  alerts: AlertItem[];
  events: TelemetryEventItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: OperationalStatus | 'ALL';
  setStatusFilter: (status: OperationalStatus | 'ALL') => void;
  refreshTelemetry: () => Promise<void>;
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  lastIngestionTime: Date;
  emergencyBroadcasts: string[];
  triggerEmergencyBroadcast: (message: string) => void;
  removeAlert: (alertId: string) => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL CONSTRAINT: Start with empty state — no dummy mock array hardcoded
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [events] = useState<TelemetryEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
      setIsLoading(true);
    }
    setError(null);

    try {
      const fetchedVehicles = await fetchVehicles();
      setVehicles(fetchedVehicles);
      setLastIngestionTime(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vehicle records.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  const refreshTelemetry = useCallback(async () => {
    await loadFleetData(true);
  }, [loadFleetData]);

  const triggerEmergencyBroadcast = useCallback((message: string) => {
    setEmergencyBroadcasts(prev => [message, ...prev]);
    // Add critical alert
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
    setAlerts(prev => [newAlert, ...prev]);
  }, []);

  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const metrics = useMemo(() => computeFleetMetrics(vehicles), [vehicles]);

  const value = {
    vehicles,
    isLoading,
    isRefreshing,
    error,
    metrics,
    alerts,
    events,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    refreshTelemetry,
    selectedVehicleId,
    setSelectedVehicleId,
    lastIngestionTime,
    emergencyBroadcasts,
    triggerEmergencyBroadcast,
    removeAlert,
  };

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
};

export const useFleet = (): FleetContextType => {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return context;
};
