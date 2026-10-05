import React from 'react';
import { Truck, CheckCircle2, Navigation, PauseCircle, WifiOff } from 'lucide-react';
import { useFleet } from '../../context/FleetContext';

export const MetricStrip: React.FC = () => {
  const { metrics, isLoading } = useFleet();

  return (
    <div className="metric-strip" aria-label="Fleet KPI Metrics">
      {/* 1. FLEET POOL */}
      <div className="kpi-card pool">
        <div className="kpi-header">
          <span className="kpi-label">Fleet Pool</span>
          <div className="kpi-icon-wrap">
            <Truck size={16} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{isLoading ? '...' : metrics.totalPool}</span>
          <div className="kpi-subtext">
            <span>In-Service: <strong>{metrics.inService}</strong></span>
            <span>•</span>
            <span>Spare: <strong>{metrics.spare}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE UNITS */}
      <div className="kpi-card active">
        <div className="kpi-header">
          <span className="kpi-label">Active Units</span>
          <div className="kpi-icon-wrap">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{isLoading ? '...' : metrics.activeUnits}</span>
          <div className="kpi-subtext">
            <span className="kpi-pill" style={{ background: '#ccfbf1', color: '#0f766e' }}>
              {metrics.activePercentage}% Deployed
            </span>
          </div>
        </div>
      </div>

      {/* 3. MOVING */}
      <div className="kpi-card moving">
        <div className="kpi-header">
          <span className="kpi-label">Moving</span>
          <div className="kpi-icon-wrap">
            <Navigation size={16} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{isLoading ? '...' : metrics.moving}</span>
          <div className="kpi-subtext">
            <span>Avg Speed: <strong>{metrics.avgSpeed} km/h</strong></span>
          </div>
        </div>
      </div>

      {/* 4. STOPPED */}
      <div className="kpi-card stopped">
        <div className="kpi-header">
          <span className="kpi-label">Stopped</span>
          <div className="kpi-icon-wrap">
            <PauseCircle size={16} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{isLoading ? '...' : metrics.stopped}</span>
          <div className="kpi-subtext">
            <span>Parked / Idle at Dock</span>
          </div>
        </div>
      </div>

      {/* 5. OFFLINE */}
      <div className="kpi-card offline">
        <div className="kpi-header">
          <span className="kpi-label">Offline</span>
          <div className="kpi-icon-wrap">
            <WifiOff size={16} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{isLoading ? '...' : metrics.offline}</span>
          <div className="kpi-subtext">
            <span>&gt;15m No GPS Ping</span>
          </div>
        </div>
      </div>
    </div>
  );
};
