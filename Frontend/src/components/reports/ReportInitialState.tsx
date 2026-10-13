import React from 'react';
import { FileBarChart, Clock, Database, CheckCircle2 } from 'lucide-react';

export const ReportInitialState: React.FC = () => {
  return (
    <div className="report-state-card" role="status" aria-label="Awaiting Report Generation">
      <div className="report-state-icon">
        <FileBarChart size={32} />
      </div>
      <h3 className="report-state-title">Ready to Generate Tracking Report</h3>
      <p className="report-state-desc">
        Configure the vehicle, hardware device, and time interval filters above, then click{' '}
        <strong style={{ color: '#0f172a' }}>"Generate Report"</strong> to query historical GPS
        waypoints, velocity logs, and heading readings from the telemetry database.
      </p>

      <div className="report-guide-pills">
        <div className="guide-pill">
          <div className="guide-pill-num">1</div>
          <span>Select Target Asset / Device</span>
        </div>
        <div className="guide-pill">
          <div className="guide-pill-num">2</div>
          <span>Define Timestamp Window</span>
        </div>
        <div className="guide-pill">
          <div className="guide-pill-num">3</div>
          <span>Analyze Realtime Audit Trail</span>
        </div>
      </div>

      <div
        style={{
          marginTop: '32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '800px',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', marginBottom: '6px' }}>
            <Database size={16} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Time-Series Telemetry</span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
            Queries high-frequency GPS ping coordinates logged by in-vehicle bonded hardware.
          </p>
        </div>

        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0d9488', marginBottom: '6px' }}>
            <Clock size={16} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Precision Timestamps</span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
            Recorded and ingested timestamps aligned with standard Indian Standard Time (IST).
          </p>
        </div>

        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', marginBottom: '6px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Audit &amp; Compliance</span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>
            Exportable report datasets ready for operational verification, fleet audit, and CSV export.
          </p>
        </div>
      </div>
    </div>
  );
};
