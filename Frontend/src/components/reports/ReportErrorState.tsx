import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ReportErrorStateProps {
  error: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const ReportErrorState: React.FC<ReportErrorStateProps> = ({
  error,
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="report-error-card" role="alert" aria-live="assertive">
      <div className="report-error-left">
        <div className="report-error-icon">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 className="report-error-title">Failed to Generate Tracking Report</h3>
          <p className="report-error-desc">
            {error || 'Unable to retrieve telemetry points from server. The reports microservice may be temporarily offline or unreachable.'}
          </p>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="btn-danger"
          onClick={onRetry}
          disabled={isRetrying}
          style={{ whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={14} className={isRetrying ? 'spin-anim' : ''} />
          <span>{isRetrying ? 'Retrying Query...' : 'Retry Query'}</span>
        </button>
      </div>
    </div>
  );
};
