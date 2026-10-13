import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';

interface ReportEmptyStateProps {
  onResetFilters?: () => void;
}

export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({ onResetFilters }) => {
  return (
    <div className="report-state-card empty" role="status" aria-label="No Records Found">
      <div className="report-state-icon">
        <SearchX size={32} />
      </div>
      <h3 className="report-state-title">No Tracking Records Found</h3>
      <p className="report-state-desc">
        There are zero recorded telemetry waypoints matching the selected vehicle, device, and time
        interval. The vehicle may have been stationary, turned off, or outside cellular reception
        during this window.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px 20px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'left',
          marginBottom: '20px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
          Suggested troubleshooting steps:
        </span>
        <ul style={{ fontSize: '0.76rem', color: '#64748b', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li>Expand your time interval (e.g. choose <strong>Past 7 Days</strong> or <strong>Past 30 Days</strong>).</li>
          <li>Select <strong>"All Registered Vehicles"</strong> to search across the entire fleet pool.</li>
          <li>Verify whether the device was active and bonded during this timeframe.</li>
        </ul>
      </div>

      {onResetFilters && (
        <button type="button" className="btn-secondary" onClick={onResetFilters}>
          <RotateCcw size={14} />
          <span>Reset Filters to Default</span>
        </button>
      )}
    </div>
  );
};
