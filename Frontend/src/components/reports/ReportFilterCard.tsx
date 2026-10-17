import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Cpu,
  Calendar,
  Filter,
  Play,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Vehicle, DeviceSummary, TrackingReportFilter } from '../../types/telemetry';

interface ReportFilterCardProps {
  vehicles: Vehicle[];
  devices: DeviceSummary[];
  isLoading: boolean;
  onGenerateReport: (filter: TrackingReportFilter) => void;
  onReset: () => void;
}

export function formatToDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type PresetType = 'today' | '24h' | '7d' | 'custom';

export const ReportFilterCard: React.FC<ReportFilterCardProps> = ({
  vehicles,
  devices,
  isLoading,
  onGenerateReport,
  onReset,
}) => {
  // Initialize with past 24 hours
  const getDefaultDates = () => {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      from: formatToDateTimeLocal(past24h),
      to: formatToDateTimeLocal(now),
    };
  };

  const initialDates = useMemo(() => getDefaultDates(), []);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(initialDates.from);
  const [dateTo, setDateTo] = useState<string>(initialDates.to);
  const [activePreset, setActivePreset] = useState<PresetType>('24h');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Combine device identifiers from vehicles and devices list
  const availableDevices = useMemo(() => {
    const map = new Map<string, { identifier: string; vehicleId?: string }>();
    devices.forEach(d => {
      if (d.identifier) {
        map.set(d.identifier, { identifier: d.identifier, vehicleId: d.vehicleId });
      }
    });
    vehicles.forEach(v => {
      if (v.deviceId) {
        const existing = map.get(v.deviceId);
        map.set(v.deviceId, { identifier: v.deviceId, vehicleId: existing?.vehicleId || v.id });
      }
    });
    return Array.from(map.values()).filter((device) => {
      return !selectedVehicleId || device.vehicleId === selectedVehicleId;
    });
  }, [devices, selectedVehicleId, vehicles]);

  // When vehicle changes, auto-select bonded device if applicable
  const handleVehicleChange = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    if (vehicleId) {
      const match = vehicles.find(v => v.id === vehicleId);
      const associatedDevice = devices.find((device) => device.vehicleId === vehicleId);
      setSelectedDeviceId(associatedDevice?.identifier || match?.deviceId || '');
    } else {
      setSelectedDeviceId('');
    }
  };

  // Preset click handler
  const handlePresetSelect = (preset: PresetType) => {
    setActivePreset(preset);
    const now = new Date();
    let fromDate: Date;

    switch (preset) {
      case '24h':
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'today':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case '7d':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }

    setDateFrom(formatToDateTimeLocal(fromDate));
    setDateTo(formatToDateTimeLocal(now));
    setValidationError(null);
  };

  // Validate date range
  const validateDates = (from: string, to: string): boolean => {
    if (!from || !to) {
      setValidationError('Both "Date From" and "Date To" are required.');
      return false;
    }
    const tFrom = new Date(from).getTime();
    const tTo = new Date(to).getTime();

    if (isNaN(tFrom) || isNaN(tTo)) {
      setValidationError('Please select valid timestamps.');
      return false;
    }
    if (tFrom > tTo) {
      setValidationError('"Date From" cannot be later than "Date To".');
      return false;
    }
    setValidationError(null);
    return true;
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      const tFrom = new Date(dateFrom).getTime();
      const tTo = new Date(dateTo).getTime();
      if (!isNaN(tFrom) && !isNaN(tTo) && tFrom > tTo) {
        setValidationError('"Date From" cannot be later than "Date To".');
      } else {
        setValidationError(null);
      }
    }
  }, [dateFrom, dateTo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDates(dateFrom, dateTo)) {
      return;
    }

    onGenerateReport({
      vehicleId: selectedVehicleId || undefined,
      deviceId: selectedDeviceId || undefined,
      dateFrom: new Date(dateFrom).toISOString(),
      dateTo: new Date(dateTo).toISOString(),
    });
  };

  const handleResetFilters = () => {
    setSelectedVehicleId('');
    setSelectedDeviceId('');
    const fresh = getDefaultDates();
    setDateFrom(fresh.from);
    setDateTo(fresh.to);
    setActivePreset('24h');
    setValidationError(null);
    onReset();
  };

  return (
    <div className="reports-filter-card" role="region" aria-label="Tracking Report Filters">
      <div className="filter-card-header">
        <div className="filter-card-title-group">
          <div className="filter-card-icon">
            <Filter size={18} />
          </div>
          <div>
            <h2 className="filter-card-title">Report Query Filters</h2>
            <p className="filter-card-subtitle">
              Choose a vehicle, device, and local date/time range.
            </p>
          </div>
        </div>

        {/* Quick presets */}
        <div className="filter-presets-row" aria-label="Date range quick presets">
          <span className="presets-label">Interval:</span>
          <button
            type="button"
            className={`preset-chip ${activePreset === 'today' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`preset-chip ${activePreset === '24h' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('24h')}
          >
            Last 24 Hours
          </button>
          <button
            type="button"
            className={`preset-chip ${activePreset === '7d' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('7d')}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`preset-chip ${activePreset === 'custom' ? 'active' : ''}`}
            onClick={() => setActivePreset('custom')}
          >
            Custom Range
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="filter-fields-grid">
          {/* Vehicle Selector */}
          <div className="filter-field">
            <label htmlFor="report-vehicle-select" className="filter-label">
              <Truck size={14} />
              <span>Vehicle Asset</span>
            </label>
            <div className="filter-control-wrap">
              <select
                id="report-vehicle-select"
                className="filter-select"
                value={selectedVehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
              >
                <option value="">All Registered Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.make} {v.model}) [{v.id}]
                  </option>
                ))}
                {vehicles.length === 0 && <option value="" disabled>No vehicles available</option>}
              </select>
            </div>
          </div>

          {/* Device Selector */}
          <div className="filter-field">
            <label htmlFor="report-device-select" className="filter-label">
              <Cpu size={14} />
              <span>Telemetry Device</span>
            </label>
            <div className="filter-control-wrap">
              <select
                id="report-device-select"
                className="filter-select"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
              >
                <option value="">All Bonded Units</option>
                {availableDevices.map((d) => (
                  <option key={d.identifier} value={d.identifier}>
                    {d.identifier} {d.vehicleId ? `(Bound to ${d.vehicleId})` : ''}
                  </option>
                ))}
                {availableDevices.length === 0 && <option value="" disabled>No devices available</option>}
              </select>
            </div>
          </div>

          {/* Date From */}
          <div className="filter-field">
            <label htmlFor="report-date-from" className="filter-label">
              <Calendar size={14} />
              <span>Date From</span>
              <span className="required-dot">*</span>
            </label>
            <div className="filter-control-wrap">
              <input
                id="report-date-from"
                type="datetime-local"
                required
                className="filter-input"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActivePreset('custom');
                }}
              />
            </div>
          </div>

          {/* Date To */}
          <div className="filter-field">
            <label htmlFor="report-date-to" className="filter-label">
              <Calendar size={14} />
              <span>Date To</span>
              <span className="required-dot">*</span>
            </label>
            <div className="filter-control-wrap">
              <input
                id="report-date-to"
                type="datetime-local"
                required
                className="filter-input"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActivePreset('custom');
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="filter-actions-row">
          <div className="filter-actions-left">
            {validationError && (
              <div className="validation-error-inline" role="alert">
                <AlertCircle size={15} />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResetFilters}
              disabled={isLoading}
              title="Clear filters and restore the Last 24 Hours default"
            >
              <RotateCcw size={14} />
              <span>Clear Filters</span>
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !!validationError}
              id="btn-generate-report"
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="spin-anim" />
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <Play size={14} style={{ fill: 'currentColor' }} />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
