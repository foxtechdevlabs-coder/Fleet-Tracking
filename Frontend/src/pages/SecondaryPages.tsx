import React from 'react';
import { Truck, Database } from 'lucide-react';
import { TelemetryWatchlist } from '../Components/dashboard/TelemetryWatchlist';

export const FleetPage: React.FC = () => {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="header-tag">
            <Truck size={13} />
            <span>ENTERPRISE ASSET REGISTRY &gt; FLEET CHASSIS</span>
          </div>
          <h1 className="page-title">Fleet Vehicles &amp; Hardware Bonding</h1>
          <p className="page-subtitle">
            Manage commercial vehicle assets, bonded GPS telemetry units, and driver assignments.
          </p>
        </div>
      </div>

      <TelemetryWatchlist />
    </>
  );
};

export const HistoryPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <div className="header-tag">
            <Database size={13} />
            <span>HISTORICAL TELEMETRY &gt; TIME-SERIES PLAYBACK</span>
          </div>
          <h1 className="page-title">Telemetry Route History</h1>
          <p className="page-subtitle">
            Query past GPS waypoint trails, sensor readings, and driver behavior logs.
          </p>
        </div>
      </div>

      <div className="panel-card" style={{ padding: '40px 24px', textAlign: 'center', alignItems: 'center' }}>
        <Database size={40} color="#0284c7" style={{ marginBottom: '12px' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>Historical Playback Engine</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '480px', marginTop: '6px' }}>
          Connect to the TimescaleDB or PostgreSQL telemetry archive to query trip playback records across any bonded vehicle.
        </p>
      </div>
    </div>
  );
};

export { ReportsPage } from './ReportsPage';

export const SettingsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <div className="header-tag">
            <span>PLATFORM CONFIGURATION</span>
          </div>
          <h1 className="page-title">Telematics Settings</h1>
          <p className="page-subtitle">
            MQTT broker gateways, ingestion node thresholds, and geofence coordinates.
          </p>
        </div>
      </div>

      <div className="panel-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
          Active Gateway Nodes (248 / 250 Online)
        </h2>
        <div style={{ fontSize: '0.84rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>• Primary Gateway: <code>mqtt.fleetops.internal:8883 (TLS 1.3)</code></div>
          <div>• Ingestion Buffer: <code>Kafka Partition Cluster (Asia-South-1)</code></div>
          <div>• Heartbeat Ping Interval: <code>1000 ms (Moving) / 30000 ms (Stationary)</code></div>
        </div>
      </div>
    </div>
  );
};
