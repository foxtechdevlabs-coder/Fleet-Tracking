import React from 'react';
import { AlertTriangle, BellOff, X } from 'lucide-react';
import { useFleet } from '../../context/FleetContext';

export const AlertsPanel: React.FC = () => {
  const { alerts, removeAlert } = useFleet();

  return (
    <div className="panel-card">
      <div className="panel-card-header">
        <div className="panel-card-title">
          <AlertTriangle size={16} color={alerts.length > 0 ? '#ef4444' : '#64748b'} />
          <span>Critical Operational Alerts</span>
        </div>
        <span className={`badge-count ${alerts.length > 0 ? 'alert' : ''}`}>
          {alerts.length} Active
        </span>
      </div>

      <div className="panel-card-body">
        {alerts.length === 0 ? (
          <div className="panel-empty-notice">
            <BellOff size={28} className="panel-empty-icon" />
            <p style={{ fontWeight: 600, color: '#475569' }}>All Telemetry Nominal</p>
            <p style={{ fontSize: '0.72rem', marginTop: '2px' }}>
              Zero unacknowledged anomalies or geofence violations detected across bonded units.
            </p>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className={`alert-card-row ${alert.severity}`}>
              <div className="alert-icon-box">
                <AlertTriangle size={15} />
              </div>
              <div className="alert-content">
                <div className="alert-title">
                  <span>{alert.title}</span>
                  <button
                    type="button"
                    onClick={() => removeAlert(alert.id)}
                    title="Acknowledge Alert"
                    style={{ color: '#94a3b8', padding: '2px' }}
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="alert-desc">{alert.message}</div>
                <div className="alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })} IST • Ref: {alert.vehicleId}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
