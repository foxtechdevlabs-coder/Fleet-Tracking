import React from 'react';
import { FileBarChart } from 'lucide-react';

export const ReportInitialState: React.FC = () => {
  return (
    <div className="report-state-card" role="status" aria-label="Awaiting Report Generation">
      <div className="report-state-icon">
        <FileBarChart size={32} />
      </div>
      <h3 className="report-state-title">No report generated</h3>
      <p className="report-state-desc">
        Select a vehicle or device and a date range, then generate a report to view returned telemetry records.
      </p>
    </div>
  );
};
