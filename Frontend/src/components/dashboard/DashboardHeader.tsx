import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, Plus, Activity, Layers } from 'lucide-react';
import { useFleet } from '../../context/FleetContext';
import { AddDeviceModal } from '../modals/AddDeviceModal';
import { EmergencyModal } from '../modals/EmergencyModal';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title = 'Operational Fleet Dashboard',
  subtitle = 'Real-time telemetry, fleet availability & active operational events',
}) => {
  const { refreshTelemetry, isRefreshing, lastIngestionTime } = useFleet();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  // Format ingestion time e.g. "26 Sep 2026, 11:42 AM IST (Asia/Kolkata Node Ingestion)"
  const formattedIngestionTime = React.useMemo(() => {
    try {
      const datePart = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(lastIngestionTime);

      const timePart = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(lastIngestionTime);

      return `${datePart}, ${timePart} IST (Asia/Kolkata Node Ingestion)`;
    } catch {
      return '26 Sep 2026, 11:42 AM IST (Asia/Kolkata Node Ingestion)';
    }
  }, [lastIngestionTime]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="header-tag">
            <Layers size={13} />
            <span>LOGISTICS COMMAND CENTER &gt; LIVE TELEMETRY FLEET</span>
          </div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>

        <div className="header-actions">
          <div className="ingestion-badge" title="Timestamp of most recent telematics batch ingestion">
            <Activity size={14} color="#0284c7" />
            <span>{formattedIngestionTime}</span>
          </div>

          <button
            className="btn-secondary"
            onClick={() => refreshTelemetry()}
            disabled={isRefreshing}
            title="Poll telemetry updates from ingestion nodes"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Telemetry'}</span>
          </button>

          <button
            className="btn-danger"
            onClick={() => setIsEmergencyModalOpen(true)}
            title="Dispatch emergency broadcast directive"
          >
            <AlertTriangle size={14} />
            <span>Emergency Broadcast</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            title="Bond a GPS device and register a new vehicle"
          >
            <Plus size={15} />
            <span>+ Add Device &amp; Vehicle</span>
          </button>
        </div>
      </div>

      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />
    </>
  );
};
