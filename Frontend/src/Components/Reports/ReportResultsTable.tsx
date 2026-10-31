import { useState, useMemo, useEffect, useRef } from 'react';
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
import './ReportResultsTable.css';
import type { LocationReportFilters, LocationReportRecord, SpeedUnit } from '../../types/fleet';

export interface ReportResultsTableProps {
  records: LocationReportRecord[];
  filter?: LocationReportFilters | null;
  timeZone?: string;
  speedUnit?: SpeedUnit;
}

const OVERSPEED_KMH = 80;
const KMH_TO_MPH = 0.621371;

function finiteInRange(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

const getLatitude = (record: LocationReportRecord) => finiteInRange(record.latitude, -90, 90);
const getLongitude = (record: LocationReportRecord) => finiteInRange(record.longitude, -180, 180);
const getSpeed = (record: LocationReportRecord) => finiteInRange(record.speed, 0, Infinity);
const getHeading = (record: LocationReportRecord) => finiteInRange(record.heading, 0, 360);
const getAltitude = (record: LocationReportRecord) => finiteInRange(record.altitude, -Infinity, Infinity);

function getHeadingDirection(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

export function formatReportTimestamp(isoOrDate: string | undefined, timeZone: string): string {
  if (!isoOrDate) return '—';
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return isoOrDate;

  try {
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone,
    });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return isoOrDate;
  }
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

export function ReportResultsTable({ records, filter, timeZone = 'UTC', speedUnit = 'km/h' }: ReportResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const exportFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The backend converts speeds to the requested unit, so convert the alert limit to match.
  const overspeedLimit = speedUnit === 'mph' ? OVERSPEED_KMH * KMH_TO_MPH : OVERSPEED_KMH;
  const overspeedLabel = `>${Math.round(overspeedLimit)} ${speedUnit}`;
  const timestampHeader = `DATE / TIME (${timeZone})`;
  const headers = [timestampHeader, 'VEHICLE', 'DEVICE', 'LATITUDE', 'LONGITUDE', `SPEED (${speedUnit})`, 'HEADING', 'ALTITUDE (m)'];

  useEffect(() => () => {
    if (exportFeedbackTimerRef.current) clearTimeout(exportFeedbackTimerRef.current);
  }, []);

  const showExportFeedback = (message: string, duration: number) => {
    if (exportFeedbackTimerRef.current) clearTimeout(exportFeedbackTimerRef.current);
    setExportFeedback(message);
    exportFeedbackTimerRef.current = setTimeout(() => {
      setExportFeedback(null);
      exportFeedbackTimerRef.current = null;
    }, duration);
  };

  // Filter records based on table search input
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r) => (
      (r.vehicleId?.toLowerCase() || '').includes(term) ||
      (r.deviceId?.toLowerCase() || '').includes(term) ||
      formatReportTimestamp(r.recordedAt, timeZone).toLowerCase().includes(term)
    ));
  }, [records, searchTerm, timeZone]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, currentPage, rowsPerPage]);

  // Only calculate metrics directly supported by the returned records.
  const maxSpeed = useMemo(() => records.reduce<number | null>((currentMax, record) => {
    const speed = getSpeed(record);
    return speed !== null && (currentMax === null || speed > currentMax) ? speed : currentMax;
  }, null), [records]);
  const isMaxOverspeed = maxSpeed !== null && maxSpeed > overspeedLimit;

  // Helper to generate compliant filenames
  const getFilenameBase = () => {
    const vId = filter?.vehicleId ? filter.vehicleId.toLowerCase() : 'all';
    const sanitize = (dateStr?: string) => (dateStr ? dateStr.replace(/[:.TZ]/g, '-').slice(0, 19) : '');
    const fromStr = sanitize(filter?.from) || 'start';
    const toStr = sanitize(filter?.to) || 'end';
    return `telemetry-report-${vId}-${fromStr}_to_${toStr}`;
  };

  const getExportValues = (record: LocationReportRecord) => [
    formatReportTimestamp(record.recordedAt, timeZone),
    record.vehicleId || '',
    record.deviceId || '',
    getLatitude(record),
    getLongitude(record),
    getSpeed(record),
    getHeading(record),
    getAltitude(record),
  ] as const;

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const XLSX = await import('xlsx');
      const rows = filteredRecords.map((record) => {
        const values = getExportValues(record);
        return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
      worksheet['!cols'] = [{ wch: 28 }, { wch: 38 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
      for (let row = 2; row <= rows.length + 1; row += 1) {
        for (const column of ['D', 'E']) {
          const cell = worksheet[`${column}${row}`];
          if (cell) cell.z = '0.00000';
        }
        for (const column of ['F', 'G', 'H']) {
          const cell = worksheet[`${column}${row}`];
          if (cell) cell.z = '0.0';
        }
      }
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Telemetry Records');
      XLSX.writeFile(workbook, `${getFilenameBase()}.xlsx`);
      showExportFeedback('Excel report downloaded successfully.', 4000);
    } catch {
      showExportFeedback('The Excel report could not be created. Please try again.', 6000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (filteredRecords.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 32;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const columnWidths = [120, 150, 150, 72, 72, 72, 66, 76];
      const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      let y = 0;

      const drawPageHeader = (includeFilters: boolean) => {
        y = margin;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        pdf.text('Telemetry Tracking Report', margin, y + 14);
        y += 25;

        if (includeFilters && filter) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          const filterLines = [
            `Vehicle: ${filter.vehicleId || 'All'}    Device: ${filter.deviceIdentifier || 'All'}`,
            `Range (${timeZone}): ${filter.from ? formatReportTimestamp(filter.from, timeZone) : 'start'} to ${filter.to ? formatReportTimestamp(filter.to, timeZone) : 'end'}`,
          ];
          filterLines.forEach((line) => {
            pdf.text(line, margin, y + 8);
            y += 12;
          });
        }

        pdf.setFillColor(15, 23, 42);
        pdf.rect(margin, y, tableWidth, 20, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        let x = margin;
        headers.forEach((header, index) => {
          pdf.text(header, x + 4, y + 13);
          x += columnWidths[index];
        });
        pdf.setTextColor(0, 0, 0);
        y += 20;
      };

      drawPageHeader(true);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);

      filteredRecords.forEach((record) => {
        const [timestamp, vehicle, device, latitude, longitude, speed, heading, altitude] = getExportValues(record);
        const cells = [
          timestamp,
          vehicle || '-',
          device || '-',
          latitude === null ? '-' : latitude.toFixed(5),
          longitude === null ? '-' : longitude.toFixed(5),
          speed === null ? '-' : speed.toFixed(1),
          heading === null ? '-' : `${heading.toFixed(1)}°`,
          altitude === null ? '-' : altitude.toFixed(1),
        ];
        const lines = cells.map((cell, index) =>
          pdf.splitTextToSize(cell, columnWidths[index] - 8) as string[],
        );
        const rowHeight = Math.max(16, ...lines.map((cellLines) => cellLines.length * 9 + 5));

        if (y + rowHeight > pageHeight - margin) {
          pdf.addPage();
          drawPageHeader(false);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
        }

        let x = margin;
        lines.forEach((cellLines, index) => {
          pdf.text(cellLines, x + 4, y + 10);
          x += columnWidths[index];
        });
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
        y += rowHeight;
      });

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: 'right' });
      }

      pdf.save(`${getFilenameBase()}.pdf`);
      showExportFeedback('PDF report downloaded successfully.', 4000);
    } catch {
      showExportFeedback('The PDF report could not be created. Please try again.', 6000);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV (.csv) according to RFC 4180
  const handleExportCsv = () => {
    if (filteredRecords.length === 0 || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);
    try {
      const escapeCsv = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      const csvRows = [headers.map(escapeCsv).join(',')];
      for (const record of filteredRecords) {
        csvRows.push(getExportValues(record).map(escapeCsv).join(','));
      }

      // UTF-8 BOM so Excel on Windows opens non-ASCII chars correctly.
      const blob = new Blob(['﻿' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${getFilenameBase()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showExportFeedback('CSV report downloaded successfully.', 4000);
    } catch {
      showExportFeedback('The CSV report could not be created. Please try again.', 6000);
    } finally {
      setIsExporting(false);
    }
  };

  const isExportDisabled = filteredRecords.length === 0 || isExporting;
  const exportTooltip = filteredRecords.length === 0
    ? (searchTerm.trim() ? 'No matching records to export' : 'Generate a report to enable export')
    : undefined;

  const startRecord = filteredRecords.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRecord = Math.min(currentPage * rowsPerPage, filteredRecords.length);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="report-results-table">
      {/* 1. Report Summary Strip */}
      <div className="report-meta-strip" aria-label="Report Metric Summary">
        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <FileSpreadsheet size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Total GPS Logs</span>
            <span className="report-meta-value">{records.length.toLocaleString()} pts</span>
          </div>
        </div>

        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#ccfbf1', color: '#0d9488' }}>
            <Cpu size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Vehicles in Report</span>
            <span className="report-meta-value">{new Set(records.map((r) => r.vehicleId)).size.toLocaleString()}</span>
          </div>
        </div>

        <div className="report-meta-card">
          <div
            className="report-meta-icon"
            style={{
              background: isMaxOverspeed ? '#fee2e2' : '#f3e8ff',
              color: isMaxOverspeed ? '#dc2626' : '#7e22ce',
            }}
          >
            {isMaxOverspeed ? <AlertTriangle size={18} /> : <Gauge size={18} />}
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Max Speed Recorded</span>
            <span className={`report-meta-value ${isMaxOverspeed ? 'alert-speed' : ''}`}>
              {maxSpeed === null
                ? '—'
                : `${maxSpeed.toFixed(1)} ${speedUnit}${isMaxOverspeed ? ` (Alert ${overspeedLabel})` : ''}`}
            </span>
          </div>
        </div>

        <div className="report-meta-card">
          <div className="report-meta-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
            <Clock size={18} />
          </div>
          <div className="report-meta-info">
            <span className="report-meta-label">Reporting Timezone</span>
            <span className="report-meta-value report-timezone-value">{timeZone}</span>
          </div>
        </div>
      </div>

      {/* 2. Telemetry Records Table Section */}
      <div className="watchlist-section" role="region" aria-label="Tracking Report Results">
        <div className="watchlist-header">
          <div>
            <h3 className="watchlist-title">Raw Telemetry Records</h3>
            <p className="watchlist-subtitle">
              {filteredRecords.length.toLocaleString()} returned record{filteredRecords.length === 1 ? '' : 's'}
              {searchTerm.trim() ? ' matching this search' : ' in this report'}
            </p>
          </div>

          <div className="watchlist-controls">
            <div className="search-input-box" style={{ width: '220px' }}>
              <Search size={14} color="#64748b" />
              <input
                type="text"
                placeholder="Search within report..."
                aria-label="Search within report"
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
              onClick={handleExportCsv}
              disabled={isExportDisabled}
              title={exportTooltip || 'Export returned records to CSV file'}
            >
              {isExporting ? <RotateCw size={14} className="spin-anim" /> : <FileText size={14} />}
              <span>Export CSV (.csv)</span>
            </button>

            <button
              type="button"
              className="export-btn"
              onClick={() => void handleExportPdf()}
              disabled={isExportDisabled}
              title={exportTooltip || 'Export returned records to PDF'}
            >
              {isExporting ? <RotateCw size={14} className="spin-anim" /> : <FileText size={14} />}
              <span>Export PDF (.pdf)</span>
            </button>

            <button
              type="button"
              className="export-btn"
              onClick={() => void handleExportExcel()}
              disabled={isExportDisabled}
              title={exportTooltip || 'Export returned records to Excel workbook'}
            >
              {isExporting ? <RotateCw size={14} className="spin-anim" /> : <FileSpreadsheet size={14} />}
              <span>{isExporting ? 'Exporting...' : 'Download Excel'}</span>
            </button>
          </div>
        </div>

        {exportFeedback && (
          <p className="report-export-feedback" role="status" aria-live="polite">
            {exportFeedback}
          </p>
        )}

        {/* 3. Responsive Table */}
        <div className="table-responsive">
          <table className="watchlist-table">
            <thead>
              <tr>
                {headers.map((header) => <th key={header} scope="col">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} style={{ textAlign: 'center', padding: '36px' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      No waypoints match the search filter "{searchTerm}"
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const latitude = getLatitude(r);
                  const longitude = getLongitude(r);
                  const speed = getSpeed(r);
                  const heading = getHeading(r);
                  const altitude = getAltitude(r);
                  const isOverSpeed = speed !== null && speed > overspeedLimit;

                  return (
                    <tr key={`${r.vehicleId}-${r.recordedAt}-${idx}`}>
                      <td>
                        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>
                          {formatReportTimestamp(r.recordedAt, timeZone)}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0284c7' }}>
                          {r.vehicleId || '—'}
                        </span>
                      </td>

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

                      <td>
                        <span className="coord-cell" title={`Latitude: ${r.latitude}`}>
                          {latitude !== null ? `${Math.abs(latitude).toFixed(5)}° ${latitude >= 0 ? 'N' : 'S'}` : '—'}
                        </span>
                      </td>

                      <td>
                        <span className="coord-cell" title={`Longitude: ${r.longitude}`}>
                          {longitude !== null ? `${Math.abs(longitude).toFixed(5)}° ${longitude >= 0 ? 'E' : 'W'}` : '—'}
                        </span>
                      </td>

                      <td>
                        {speed !== null ? (
                          <span className={`speed-badge ${isOverSpeed ? 'overspeed' : speed > 0 ? 'moving' : 'stopped'}`}>
                            <Gauge size={11} />
                            <span>
                              {speed.toFixed(1)} {speedUnit}{isOverSpeed ? ' (Overspeed)' : ''}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      <td>
                        {heading !== null ? (
                          <span className="heading-badge">
                            <span
                              style={{
                                display: 'inline-flex',
                                transform: `rotate(${Math.round(heading)}deg)`,
                                transition: 'transform 0.2s',
                              }}
                            >
                              <Compass size={12} color="#0284c7" />
                            </span>
                            <span>
                              {Math.round(heading)}° {getHeadingDirection(heading)}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      <td>
                        <span className="coord-cell">{altitude !== null ? `${altitude.toFixed(1)} m` : '—'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pagination */}
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
                aria-label="Rows per page"
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
}
