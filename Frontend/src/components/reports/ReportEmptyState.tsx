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
        No telemetry records were found for the selected filters. Adjust the vehicle, device, or date range and try again.
      </p>

      {onResetFilters && (
        <button type="button" className="btn-secondary" onClick={onResetFilters}>
          <RotateCcw size={14} />
          <span>Reset Filters to Default</span>
        </button>
      )}
    </div>
  );
};
