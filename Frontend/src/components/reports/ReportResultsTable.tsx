import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Compass,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Gauge,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import type { TrackingReportRecord } from '../../types/telemetry';

interface ReportResultsTableProps {
  records: TrackingReportRecord[];
}

const REPORT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function getHeadingDirection(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

function formatTimestamp(isoOrDate: string): { dateStr: string; timeStr: string } {
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return { dateStr: isoOrDate, timeStr: '' };

    const dateStr = d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      timeZone: REPORT_TIME_ZONE,
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: REPORT_TIME_ZONE,
    });

    return { dateStr, timeStr };
  } catch {
    return { dateStr: isoOrDate, timeStr: '' };
  }
}

export const ReportResultsTable: React.FC<ReportResultsTableProps> = ({ records }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
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

  // Only metrics directly supported by the returned records are calculated.
  const stats = useMemo(() => {
    const speeds = records
      .map((r) => r.speed)
      .filter((speed): speed is number => typeof speed === 'number' && Number.isFinite(speed));

    return {
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
    };
  }, [records]);

  const handleExportExcel = async () => {
    if (records.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const XLSX = await import('xlsx');
      const rows = records.map((record) => ({
        'Date / Time': record.recordedAt,
        Vehicle: record.plateNumber || record.vehicleId || '',
        Device: record.deviceId || '',
        Latitude: Number.isFinite(record.latitude) ? record.latitude : '',
        Longitude: Number.isFinite(record.longitude) ? record.longitude : '',
        'Speed (km/h)': record.speed ?? '',
        'Heading (degrees)': record.heading ?? '',
        'Altitude (m)': record.altitude ?? '',
        Ignition: record.ignition ?? '',
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Telemetry Records');
      XLSX.writeFile(workbook, `fleet-tracking-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setExportFeedback('Excel report downloaded.');
    } catch {
      setExportFeedback('The Excel report could not be created. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="report-meta-strip" aria-label="Report Metric Summary">
        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <FileSpreadsheet size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Total GPS Logs</span>
            <span className="report-meta-value">{records.length.toLocaleString()}</span>
          </div>
        </div>

        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#ccfbf1', color: '#0d9488' }}>
            <Compass size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Total Distance</span>
            <span className="report-meta-value">&mdash;</span>
          </div>
        </div>

        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Operating Engine</span>
            <span className="report-meta-value">&mdash;</span>
          </div>
        </div>

        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
            <Gauge size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Max Speed Recorded</span>
            <span className="report-meta-value">
              {stats.maxSpeed === null ? '\u2014' : `${stats.maxSpeed.toLocaleString()} km/h`}
            </span>
          </div>
        </div>

        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
            <Clock size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Reporting Timezone</span>
            <span className="report-meta-value report-timezone-value">{REPORT_TIME_ZONE}</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
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
            <div className="search-input-box" style={{ width: '240px' }}>
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

            <button
              type="button"
              className="export-btn"
              onClick={() => void handleExportExcel()}
              disabled={records.length === 0 || isExporting}
              title="Export returned records to an Excel workbook"
            >
              {isExporting ? <Download size={14} className="spin-anim" /> : <FileSpreadsheet size={14} />}
              <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
            <button type="button" className="export-btn" disabled title="PDF export is not implemented">
              <FileText size={14} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {exportFeedback && (
          <p className="report-export-feedback" role="status" aria-live="polite">
            {exportFeedback}
          </p>
        )}

        {/* Responsive Table */}
        <div className="table-responsive">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th scope="col">Date / Time ({REPORT_TIME_ZONE})</th>
                <th scope="col">Vehicle Info</th>
                <th scope="col">Device Info</th>
                <th scope="col">Latitude</th>
                <th scope="col">Longitude</th>
                <th scope="col">Speed</th>
                <th scope="col">Heading</th>
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
                  const { dateStr, timeStr } = formatTimestamp(r.recordedAt);
                  const isSpeedAvailable = typeof r.speed === 'number' && Number.isFinite(r.speed);
                  const isHeadingAvailable = typeof r.heading === 'number' && Number.isFinite(r.heading);

                  return (
                    <tr key={r.id || `${r.recordedAt}-${idx}`}>
                      {/* Date/Time Column */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                            {dateStr}
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.74rem',
                              color: '#64748b',
                            }}
                          >
                            <Clock size={11} />
                            <span>{timeStr || r.recordedAt}</span>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle Info Column */}
                      <td>
                        {r.plateNumber ? (
                          <>
                            <div className="plate-badge">
                              <div className="flag-strip" />
                              <span>{r.plateNumber}</span>
                            </div>
                            {(r.vehicleMake || r.vehicleModel) && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                {r.vehicleMake} {r.vehicleModel}
                              </div>
                            )}
                          </>
                        ) : r.vehicleId ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0284c7' }}>
                            {r.vehicleId}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Device Info Column */}
                      <td>
                        {r.deviceId ? (
                          <span className="device-chip">
                            <Cpu size={12} color="#0284c7" />
                            <span>{r.deviceId}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Latitude Column */}
                      <td>
                        {typeof r.latitude === 'number' && Number.isFinite(r.latitude) ? (
                          <span className="coord-cell" title={`Latitude: ${r.latitude}`}>
                            {r.latitude}°
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Longitude Column */}
                      <td>
                        {typeof r.longitude === 'number' && Number.isFinite(r.longitude) ? (
                          <span className="coord-cell" title={`Longitude: ${r.longitude}`}>
                            {r.longitude}°
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Speed Column (Conditional with fallback '-') */}
                      <td>
                        {isSpeedAvailable ? (
                          <span
                            className={`speed-badge ${
                              r.speed! > 0 ? 'moving' : 'stopped'
                            }`}
                          >
                            <Gauge size={11} />
                            <span>{r.speed} km/h</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', paddingLeft: '8px' }}>-</span>
                        )}
                      </td>

                      {/* Heading Column (Conditional with fallback '-') */}
                      <td>
                        {isHeadingAvailable ? (
                          <span className="heading-badge">
                            <Compass size={12} color="#0284c7" />
                            <span>
                              {Math.round(r.heading!)}° {getHeadingDirection(r.heading!)}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', paddingLeft: '8px' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Row Count Footer */}
        <div className="watchlist-footer">
          <div className="pagination-info">
            Showing{' '}
            <strong>
              {filteredRecords.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(currentPage * rowsPerPage, filteredRecords.length)}
            </strong>{' '}
            of <strong>{filteredRecords.length}</strong> returned records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
              <span>Rows per page:</span>
              <select
                className="rows-per-page-select"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '5px 10px' }}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              <span style={{ fontSize: '0.8rem', color: '#475569', minWidth: '60px', textAlign: 'center' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '5px 10px' }}
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
