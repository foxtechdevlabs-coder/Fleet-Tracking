import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Crosshair,
  Radio,
  Plus,
  Compass,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { TableColumnConfig } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';
import { AddDeviceModal } from '../modals/AddDeviceModal';
import { QuickTrackModal } from '../modals/QuickTrackModal';

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: 'vehicleId', label: 'Vehicle ID', visible: true },
  { key: 'plateNumber', label: 'Registration Plate', visible: true },
  { key: 'driver', label: 'Driver In Charge', visible: true },
  { key: 'status', label: 'Operational Status', visible: true },
  { key: 'speedHeading', label: 'Speed / Heading', visible: true },
  { key: 'lastIngestion', label: 'Last Ingestion', visible: true },
  { key: 'coordinates', label: 'Current Coordinates', visible: true },
  { key: 'actions', label: 'Actions', visible: true },
];

export const TelemetryWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const {
    vehicles,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
  } = useFleet();

  const [columns, setColumns] = useState<TableColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const toggleColumn = (key: string) => {
    setColumns(prev =>
      prev.map(col => (col.key === key ? { ...col, visible: !col.visible } : col))
    );
  };

  const isColVisible = (key: string) => {
    const col = columns.find(c => c.key === key);
    return col ? col.visible : true;
  };

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Status filter
      if (statusFilter !== 'ALL' && v.operationalStatus !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesPlate = v.plateNumber.toLowerCase().includes(query);
        const matchesId = v.id.toLowerCase().includes(query);
        const matchesDriver = v.driverName?.toLowerCase().includes(query);
        const matchesModel = `${v.make} ${v.model}`.toLowerCase().includes(query);
        return matchesPlate || matchesId || matchesDriver || matchesModel;
      }
      return true;
    });
  }, [vehicles, statusFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / itemsPerPage));
  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVehicles.slice(start, start + itemsPerPage);
  }, [filteredVehicles, currentPage]);

  const handleTrackNow = (vehicleId: string) => {
    navigate(`/tracking/${encodeURIComponent(vehicleId)}`);
  };

  return (
    <section className="watchlist-section" aria-label="Quick Fleet Telemetry Watchlist">
      {/* Header & Controls */}
      <div className="watchlist-header">
        <div>
          <h2 className="watchlist-title">Quick Fleet Telemetry Watchlist</h2>
          <p className="watchlist-subtitle">
            High-frequency sensor metrics across bonded vehicles
          </p>
        </div>

        <div className="watchlist-controls">
          {/* Status Tabs */}
          <div className="status-tabs" role="tablist">
            {(['ALL', 'MOVING', 'STOPPED', 'OFFLINE', 'MAINTENANCE'] as const).map(status => (
              <button
                key={status}
                type="button"
                className={`status-tab ${statusFilter === status ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="search-input-box">
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Filter plate, vehicle, driver..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Columns Customization Button */}
          <div className="columns-dropdown-wrapper">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowColumnsMenu(prev => !prev)}
              title="Configure visible table columns"
            >
              <SlidersHorizontal size={14} />
              <span>Columns</span>
            </button>

            {showColumnsMenu && (
              <div className="columns-menu">
                <div style={{
                  padding: '4px 8px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  Toggle Columns
                </div>
                {columns.map(col => (
                  <label
                    key={col.key}
                    className="column-toggle-item"
                    onClick={() => toggleColumn(col.key)}
                  >
                    <span style={{
                      width: '14px',
                      height: '14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: col.visible ? '#0284c7' : '#ffffff',
                      borderColor: col.visible ? '#0284c7' : '#cbd5e1'
                    }}>
                      {col.visible && <Check size={11} color="#ffffff" />}
                    </span>
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Content or Professional Empty State */}
      <div className="table-responsive">
        <table className="watchlist-table">
          <thead>
            <tr>
              {isColVisible('vehicleId') && <th>Vehicle ID</th>}
              {isColVisible('plateNumber') && <th>Registration Plate</th>}
              {isColVisible('driver') && <th>Driver In Charge</th>}
              {isColVisible('status') && <th>Operational Status</th>}
              {isColVisible('speedHeading') && <th>Speed / Heading</th>}
              {isColVisible('lastIngestion') && <th>Last Ingestion</th>}
              {isColVisible('coordinates') && <th>Current Coordinates</th>}
              {isColVisible('actions') && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedVehicles.length === 0 ? (
              <tr>
                <td colSpan={columns.filter(c => c.visible).length}>
                  <div className="table-empty-state">
                    <div className="table-empty-icon">
                      <Radio size={28} />
                    </div>
                    <div className="table-empty-title">
                      No vehicles connected to telemetry feed
                    </div>
                    <p className="table-empty-desc">
                      Connect a device or search for a registered vehicle ID. Once connected, live sensor telemetry, GPS coordinates, and speed telemetry will display automatically.
                    </p>
                    <div className="table-empty-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setIsAddModalOpen(true)}
                      >
                        <Plus size={15} />
                        <span>Connect Device &amp; Vehicle</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setIsTrackModalOpen(true)}
                      >
                        <Crosshair size={14} />
                        <span>Track by Vehicle ID</span>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedVehicles.map(v => (
                <tr key={v.id}>
                  {isColVisible('vehicleId') && (
                    <td>
                      <span className="vehicle-id-cell">
                        <Radio size={12} />
                        <span>{v.id}</span>
                      </span>
                    </td>
                  )}

                  {isColVisible('plateNumber') && (
                    <td>
                      <div className="plate-badge">
                        <div className="flag-strip" />
                        <span>{v.plateNumber}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                        {v.make} {v.model}
                      </div>
                    </td>
                  )}

                  {isColVisible('driver') && (
                    <td>
                      <div style={{ fontWeight: 500, color: '#1e293b' }}>
                        {v.driverName || 'Unassigned'}
                      </div>
                      {v.driverPhone && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {v.driverPhone}
                        </div>
                      )}
                    </td>
                  )}

                  {isColVisible('status') && (
                    <td>
                      <span className={`status-badge ${v.operationalStatus}`}>
                        <span className="status-badge-dot" />
                        <span>{v.operationalStatus}</span>
                      </span>
                    </td>
                  )}

                  {isColVisible('speedHeading') && (
                    <td>
                      <div className="speed-cell">
                        <span>{v.telemetry?.speed ?? 0} km/h</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        color: '#64748b'
                      }}>
                        <Compass size={11} />
                        <span>{v.telemetry?.heading ?? 0}° Heading</span>
                      </div>
                    </td>
                  )}

                  {isColVisible('lastIngestion') && (
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#64748b' }}>
                      {v.telemetry?.ingestedAt
                        ? new Date(v.telemetry.ingestedAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          }) + ' IST'
                        : 'Just now'}
                    </td>
                  )}

                  {isColVisible('coordinates') && (
                    <td className="coord-cell">
                      {v.telemetry
                        ? `${v.telemetry.latitude.toFixed(4)}° N, ${v.telemetry.longitude.toFixed(4)}° E`
                        : 'Awaiting Fix'}
                    </td>
                  )}

                  {isColVisible('actions') && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-track-now"
                        onClick={() => handleTrackNow(v.id)}
                        title={`Focus live tracking for ${v.id}`}
                      >
                        <Crosshair size={13} />
                        <span>Track Now</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Pagination */}
      <div className="watchlist-footer">
        <div className="pagination-info">
          Showing <strong>{paginatedVehicles.length}</strong> of <strong>{filteredVehicles.length}</strong> monitored vehicles
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>

          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx + 1}
              type="button"
              className={`page-btn ${currentPage === idx + 1 ? 'active' : ''}`}
              onClick={() => setCurrentPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}

          <button
            type="button"
            className="page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <QuickTrackModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />
    </section>
  );
};
