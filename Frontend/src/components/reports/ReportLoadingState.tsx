import React from 'react';
import { Loader2 } from 'lucide-react';

interface ReportLoadingStateProps {
  rows?: number;
}

export const ReportLoadingState: React.FC<ReportLoadingStateProps> = ({ rows = 6 }) => {
  const rowList = Array.from({ length: rows }, (_, i) => i);

  return (
    <div className="watchlist-section" role="status" aria-label="Loading Report Data">
      <div className="watchlist-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Loader2 size={18} className="spin-anim" style={{ color: '#0284c7' }} />
          <div>
            <h3 className="watchlist-title">Querying Telemetry Archive...</h3>
            <p className="watchlist-subtitle">
              Retrieving historical GPS fixes, speed sensors, and heading orientation
            </p>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Vehicle Asset</th>
              <th>Device Identifier</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Speed (km/h)</th>
              <th>Heading</th>
            </tr>
          </thead>
          <tbody>
            {rowList.map((index) => (
              <tr key={index}>
                <td style={{ width: '180px' }}>
                  <div className="skeleton-cell" style={{ width: '130px' }} />
                </td>
                <td style={{ width: '180px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="skeleton-cell" style={{ width: '100px', height: '20px' }} />
                    <div className="skeleton-cell" style={{ width: '80px', height: '12px' }} />
                  </div>
                </td>
                <td style={{ width: '140px' }}>
                  <div className="skeleton-cell" style={{ width: '90px', height: '18px' }} />
                </td>
                <td style={{ width: '130px' }}>
                  <div className="skeleton-cell" style={{ width: '85px' }} />
                </td>
                <td style={{ width: '130px' }}>
                  <div className="skeleton-cell" style={{ width: '85px' }} />
                </td>
                <td style={{ width: '120px' }}>
                  <div className="skeleton-cell" style={{ width: '65px', height: '20px' }} />
                </td>
                <td style={{ width: '120px' }}>
                  <div className="skeleton-cell" style={{ width: '70px' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
