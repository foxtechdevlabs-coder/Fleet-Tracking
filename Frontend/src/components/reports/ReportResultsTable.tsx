import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Compass,
  Search,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Gauge,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import type { TrackingReportFilter, TrackingReportRecord } from '../../types/telemetry';

export interface ReportResultsTableProps {
  records: TrackingReportRecord[];
  filter?: TrackingReportFilter | null;
}

const REPORT_TIME_ZONE_DISPLAY = 'Asia/Kolkata (UTC +05:30)';

function getHeadingDirection(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

export function formatReportTimestampIST(isoOrDate: string): string {
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate || '—';

    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    return `${dateStr}, ${timeStr} IST`;
  } catch {
    return isoOrDate || '—';
  }
}

export function formatVehicleColumn(r: TrackingReportRecord): string {
  if (r.vehicleId && r.plateNumber) {
    return `${r.vehicleId} (${r.plateNumber})`;
  }
  if (r.plateNumber) return r.plateNumber;
  if (r.vehicleId) return r.vehicleId;
  return '—';
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTotalDistance(records: TrackingReportRecord[]): number {
  if (records.length < 2) return 0;
  let totalKm = 0;
  let prev: [number, number] | null = null;
  for (const r of records) {
    if (
      typeof r.latitude === 'number' && Number.isFinite(r.latitude) &&
      typeof r.longitude === 'number' && Number.isFinite(r.longitude)
    ) {
      if (prev) {
        const d = haversineDistanceKm(prev[0], prev[1], r.latitude, r.longitude);
        if (d > 0.001 && d < 500) {
          totalKm += d;
        }
      }
      prev = [r.latitude, r.longitude];
    }
  }
  return totalKm;
}

function calculateOperatingEngine(records: TrackingReportRecord[]): string {
  if (records.length === 0) return '—';

  const sorted = [...records]
    .filter((r) => r.recordedAt)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (sorted.length < 2) return '—';

  let operatingMs = 0;
  let hasSignals = false;

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const dt = new Date(next.recordedAt).getTime() - new Date(curr.recordedAt).getTime();
    if (dt > 0 && dt <= 3600000) {
      if (curr.ignition === true || (typeof curr.speed === 'number' && curr.speed > 0)) {
        operatingMs += dt;
        hasSignals = true;
      } else if (curr.ignition === false) {
        hasSignals = true;
      }
    }
  }

  if (!hasSignals && operatingMs === 0) {
    return '—';
  }

  const hours = Math.floor(operatingMs / 3600000);
  const minutes = Math.floor((operatingMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [1];
  if (current > 3) {
    pages.push('...');
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) {
    pages.push('...');
  }
  pages.push(total);
  return pages;
}

export const ReportResultsTable: React.FC<ReportResultsTableProps> = ({ records, filter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Filter records based on table search input
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r) => {
      const plate = r.plateNumber?.toLowerCase() || '';
      const vId = r.vehicleId?.toLowerCase() || '';
      const dev = r.deviceId?.toLowerCase() || '';
      const make = r.vehicleMake?.toLowerCase() || '';
      const model = r.vehicleModel?.toLowerCase() || '';
      const time = r.recordedAt?.toLowerCase() || '';
      return (
        plate.includes(term) ||
        vId.includes(term) ||
        dev.includes(term) ||
        make.includes(term) ||
        model.includes(term) ||
        time.includes(term)
      );
    });
  }, [records, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, currentPage, rowsPerPage]);

  // Derived 5 Summary Metrics
  const stats = useMemo(() => {
    const speeds = records
      .map((r) => r.speed)
      .filter((speed): speed is number => typeof speed === 'number' && Number.isFinite(speed));

    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : null;
    const totalDistance = calculateTotalDistance(records);
    const engineHours = calculateOperatingEngine(records);

    return {
      maxSpeed,
      totalDistance,
      engineHours,
    };
  }, [records]);

  // Helper to generate compliant filenames
  const getFilenameBase = () => {
    const vId = filter?.vehicleId ? filter.vehicleId.toLowerCase() : 'all';
    const sanitize = (dateStr?: string) => {
      if (!dateStr) return '';
      return dateStr.replace(/[:.TZ]/g, '-').slice(0, 19);
    };
    const fromStr = sanitize(filter?.dateFrom) || 'start';
    const toStr = sanitize(filter?.dateTo) || 'end';
    return `telemetry-report-${vId}-${fromStr}_to_${toStr}`;
  };

  // Export to Excel (.xlsx) using exact 7 columns
  const handleExportExcel = async () => {
    if (records.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const XLSX = await import('xlsx');
      const rows = records.map((record) => {
        const dateTime = formatReportTimestampIST(record.recordedAt);
        const vehicle = formatVehicleColumn(record);
        const device = record.deviceId || '—';
        const lat = typeof record.latitude === 'number' && Number.isFinite(record.latitude)
          ? `${Math.abs(record.latitude).toFixed(5)}° ${record.latitude >= 0 ? 'N' : 'S'}`
          : '—';
        const lng = typeof record.longitude === 'number' && Number.isFinite(record.longitude)
          ? `${Math.abs(record.longitude).toFixed(5)}° ${record.longitude >= 0 ? 'E' : 'W'}`
          : '—';
        const speed = typeof record.speed === 'number' && Number.isFinite(record.speed)
          ? (record.speed > 80 ? `${record.speed.toFixed(1)} km/h (Overspeed)` : `${record.speed.toFixed(1)} km/h`)
          : '—';
        const heading = typeof record.heading === 'number' && Number.isFinite(record.heading)
          ? `${Math.round(record.heading)}° ${getHeadingDirection(record.heading)}`
          : '—';

        return {
          'DATE / TIME (IST)': dateTime,
          'VEHICLE': vehicle,
          'DEVICE': device,
          'LATITUDE': lat,
          'LONGITUDE': lng,
          'SPEED': speed,
          'HEADING': heading,
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Telemetry Records');
      XLSX.writeFile(workbook, `${getFilenameBase()}.xlsx`);
      setExportFeedback('Excel report downloaded successfully.');
      setTimeout(() => setExportFeedback(null), 4000);
    } catch {
      setExportFeedback('The Excel report could not be created. Please try again.');
      setTimeout(() => setExportFeedback(null), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV (.csv) using exact 7 columns according to RFC 4180
  const handleExportCsv = () => {
    if (records.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);
    try {
      const headers = [
        'DATE / TIME (IST)',
        'VEHICLE',
        'DEVICE',
        'LATITUDE',
        'LONGITUDE',
        'SPEED',
        'HEADING',
      ];

      const escapeCsv = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csvRows = [headers.map(escapeCsv).join(',')];

      for (const record of records) {
        const dateTime = formatReportTimestampIST(record.recordedAt);
        const vehicle = formatVehicleColumn(record);
        const device = record.deviceId || '—';
        const lat = typeof record.latitude === 'number' && Number.isFinite(record.latitude)
          ? `${Math.abs(record.latitude).toFixed(5)}° ${record.latitude >= 0 ? 'N' : 'S'}`
          : '—';
        const lng = typeof record.longitude === 'number' && Number.isFinite(record.longitude)
          ? `${Math.abs(record.longitude).toFixed(5)}° ${record.longitude >= 0 ? 'E' : 'W'}`
          : '—';
        const speed = typeof record.speed === 'number' && Number.isFinite(record.speed)
          ? (record.speed > 80 ? `${record.speed.toFixed(1)} km/h (Overspeed)` : `${record.speed.toFixed(1)} km/h`)
          : '—';
        const heading = typeof record.heading === 'number' && Number.isFinite(record.heading)
          ? `${Math.round(record.heading)}° ${getHeadingDirection(record.heading)}`
          : '—';

        csvRows.push([
          escapeCsv(dateTime),
          escapeCsv(vehicle),
          escapeCsv(device),
          escapeCsv(lat),
          escapeCsv(lng),
          escapeCsv(speed),
          escapeCsv(heading),
        ].join(','));
      }

      const csvContent = csvRows.join('\r\n');
      // RFC 4180 CSV with UTF-8 BOM so Excel on Windows opens non-ASCII chars correctly.
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${getFilenameBase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportFeedback('CSV report downloaded successfully.');
      setTimeout(() => setExportFeedback(null), 4000);
    } catch {
      setExportFeedback('The CSV report could not be created. Please try again.');
      setTimeout(() => setExportFeedback(null), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  const isExportDisabled = records.length === 0 || isExporting;
  const exportTooltip = records.length === 0 ? 'Generate a report to enable export' : undefined;

  const startRecord = filteredRecords.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecord = Math.min(currentPage * rowsPerPage, filteredRecords.length);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Report Summary Strip (5 Metric Cards) */}
      <div className="report-meta-strip" aria-label="Report Metric Summary">
        {/* Metric 1: Total GPS Logs */}
        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <FileSpreadsheet size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Total GPS Logs</span>
            <span className="report-meta-value">
              {records.length > 0 ? `${records.length.toLocaleString()} pts` : '0 pts'}
            </span>
          </div>
        </div>

        {/* Metric 2: Total Distance */}
        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#ccfbf1', color: '#0d9488' }}>
            <Compass size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Total Distance</span>
            <span className="report-meta-value">
              {records.length > 0 && stats.totalDistance > 0
                ? `${stats.totalDistance.toFixed(1)} km`
                : '—'}
            </span>
          </div>
        </div>

        {/* Metric 3: Operating Engine */}
        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Operating Engine</span>
            <span className="report-meta-value">{stats.engineHours}</span>
          </div>
        </div>

        {/* Metric 4: Max Speed Recorded (Alert style if > 80 km/h) */}
        <div className="report-meta-card">
          <div
            className="report-meta-icon"
            style={{
              background: stats.maxSpeed !== null && stats.maxSpeed > 80 ? '#fee2e2' : '#f3e8ff',
              color: stats.maxSpeed !== null && stats.maxSpeed > 80 ? '#dc2626' : '#7e22ce',
            }}
          >
            {stats.maxSpeed !== null && stats.maxSpeed > 80 ? (
              <AlertTriangle size={18} />
            ) : (
              <Gauge size={18} />
            )}
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Max Speed Recorded</span>
            <span
              className={`report-meta-value ${
                stats.maxSpeed !== null && stats.maxSpeed > 80 ? 'alert-speed' : ''
              }`}
            >
              {stats.maxSpeed === null
                ? '—'
                : `${stats.maxSpeed.toFixed(1)} km/h${stats.maxSpeed > 80 ? ' (Alert >80)' : ''}`}
            </span>
          </div>
        </div>

        {/* Metric 5: Reporting Timezone */}
        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
            <Clock size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Reporting Timezone</span>
            <span className="report-meta-value report-timezone-value">{REPORT_TIME_ZONE_DISPLAY}</span>
          </div>
        </div>
      </div>

      {/* 2. Telemetry Records Table Section */}
      <div className="watchlist-section" role="region" aria-label="Tracking Report Results">
        {/* Table Header Controls */}
        <div className="watchlist-header">
          <div>
            <h3 className="watchlist-title">Raw Telemetry Records</h3>
            <p className="watchlist-subtitle">
              {filteredRecords.length.toLocaleString()} returned record{filteredRecords.length === 1 ? '' : 's'}
              {searchTerm.trim() ? ' matching this search' : ' in this report'}
            </p>
          </div>

          <div className="watchlist-controls">
            {/* Quick table search */}
            <div className="search-input-box" style={{ width: '220px' }}>
              <Search size={14} color="#64748b" />
              <input
                type="text"
                placeholder="Search within report..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              className="export-btn"
              onClick={handleExportCsv}
              disabled={isExportDisabled}
              title={exportTooltip || 'Export returned records to CSV file'}
            >
              {isExporting ? <RotateCw size={14} className="spin-anim" /> : <FileText size={14} />}
              <span>Export CSV (.csv)</span>
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              className="export-btn"
              onClick={() => void handleExportExcel()}
              disabled={isExportDisabled}
              title={exportTooltip || 'Export returned records to Excel workbook'}
            >
              {isExporting ? <RotateCw size={14} className="spin-anim" /> : <FileSpreadsheet size={14} />}
              <span>{isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {exportFeedback && (
          <p className="report-export-feedback" role="status" aria-live="polite">
            {exportFeedback}
          </p>
        )}

        {/* 3. Responsive 7-Column Table */}
        <div className="table-responsive">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th scope="col">DATE / TIME (IST)</th>
                <th scope="col">VEHICLE</th>
                <th scope="col">DEVICE</th>
                <th scope="col">LATITUDE</th>
                <th scope="col">LONGITUDE</th>
                <th scope="col">SPEED</th>
                <th scope="col">HEADING</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      No waypoints match the search filter "{searchTerm}"
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const dateTimeFormatted = formatReportTimestampIST(r.recordedAt);
                  const vehicleFormatted = formatVehicleColumn(r);
                  const isSpeedAvailable = typeof r.speed === 'number' && Number.isFinite(r.speed);
                  const isOverSpeed = isSpeedAvailable && (r.speed as number) > 80;
                  const isHeadingAvailable = typeof r.heading === 'number' && Number.isFinite(r.heading);

                  const latFormatted = typeof r.latitude === 'number' && Number.isFinite(r.latitude)
                    ? `${Math.abs(r.latitude).toFixed(5)}° ${r.latitude >= 0 ? 'N' : 'S'}`
                    : '—';

                  const lngFormatted = typeof r.longitude === 'number' && Number.isFinite(r.longitude)
                    ? `${Math.abs(r.longitude).toFixed(5)}° ${r.longitude >= 0 ? 'E' : 'W'}`
                    : '—';

                  return (
                    <tr key={r.id || `${r.recordedAt}-${idx}`}>
                      {/* Column 1: DATE / TIME (IST) */}
                      <td>
                        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                          {dateTimeFormatted}
                        </span>
                      </td>

                      {/* Column 2: VEHICLE */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0284c7' }}>
                            {vehicleFormatted}
                          </span>
                          {(r.vehicleMake || r.vehicleModel) && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {r.vehicleMake} {r.vehicleModel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 3: DEVICE */}
                      <td>
                        {r.deviceId ? (
                          <span className="device-chip">
                            <Cpu size={12} color="#0284c7" />
                            <span>{r.deviceId}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Column 4: LATITUDE */}
                      <td>
                        <span className="coord-cell" title={`Latitude: ${r.latitude}`}>
                          {latFormatted}
                        </span>
                      </td>

                      {/* Column 5: LONGITUDE */}
                      <td>
                        <span className="coord-cell" title={`Longitude: ${r.longitude}`}>
                          {lngFormatted}
                        </span>
                      </td>

                      {/* Column 6: SPEED (Flagged in red if > 80 km/h) */}
                      <td>
                        {isSpeedAvailable ? (
                          <span
                            className={`speed-badge ${
                              isOverSpeed ? 'overspeed' : r.speed! > 0 ? 'moving' : 'stopped'
                            }`}
                          >
                            <Gauge size={11} />
                            <span>
                              {r.speed!.toFixed(1)} km/h{isOverSpeed ? ' (Overspeed)' : ''}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Column 7: HEADING */}
                      <td>
                        {isHeadingAvailable ? (
                          <span className="heading-badge">
                            <span
                              style={{
                                display: 'inline-flex',
                                transform: `rotate(${Math.round(r.heading!)}deg)`,
                                transition: 'transform 0.2s',
                              }}
                            >
                              <Compass size={12} color="#0284c7" />
                            </span>
                            <span>
                              {Math.round(r.heading!)}° {getHeadingDirection(r.heading!)}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pagination: 1 - 15 of 1,420 records with [<] [1] [2] [3] ... [95] [>] */}
        <div className="watchlist-footer">
          <div className="pagination-info">
            <span>
              <strong>{startRecord} - {endRecord}</strong> of{' '}
              <strong>{filteredRecords.length.toLocaleString()}</strong> records
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
              <span>Show:</span>
              <select
                className="rows-per-page-select"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={13} />
              </button>

              {pageNumbers.map((pageNum, idx) => {
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.8rem' }}>
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={`page-${pageNum}`}
                    type="button"
                    className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                className="page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
