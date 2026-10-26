import React from 'react';
import { Activity, RadioTower } from 'lucide-react';
import { useFleet } from '../../context/FleetContext';

export const ActivityLogPanel: React.FC = () => {
  const { events } = useFleet();

  return (
    <div className="panel-card">
      <div className="panel-card-header">
        <div className="panel-card-title">
          <Activity size={16} color="#0284c7" />
          <span>Recent Activity Log</span>
        </div>
        <span className="badge-count stream">Live Ingestion Stream</span>
      </div>

      <div className="panel-card-body">
        {events.length === 0 ? (
          <div className="panel-empty-notice">
            <RadioTower size={28} className="panel-empty-icon" />
            <p style={{ fontWeight: 600, color: '#475569' }}>Ingestion Stream Idle</p>
            <p style={{ fontSize: '0.72rem', marginTop: '2px' }}>
              Awaiting inbound MQTT/HTTP edge telemetry packets from bonded vehicle units.
            </p>
          </div>
        ) : (
          <div className="timeline-list">
            {events.map(event => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <div className="timeline-summary">{event.summary}</div>
                  <div className="timeline-meta">
                    {new Date(event.ingestedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    })} IST • Node: {event.deviceId || event.vehicleId}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
