import React, { useState } from 'react';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { MetricStrip } from '../components/dashboard/MetricStrip';
import { MapViewport } from '../components/dashboard/MapViewport';
import { AlertsPanel } from '../components/dashboard/AlertsPanel';
import { ActivityLogPanel } from '../components/dashboard/ActivityLogPanel';
import { TelemetryWatchlist } from '../components/dashboard/TelemetryWatchlist';
import { AddDeviceModal } from '../components/modals/AddDeviceModal';

export const DashboardPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <>
      {/* 1. Header & Actions */}
      <DashboardHeader />

      {/* 2. KPI Metric Strip */}
      <MetricStrip />

      {/* 3. Map Viewport & Side Panels */}
      <div className="telematics-viewport-grid">
        <MapViewport onAddDeviceClick={() => setIsAddModalOpen(true)} />

        <div className="side-panels-column">
          <AlertsPanel />
          <ActivityLogPanel />
        </div>
      </div>

      {/* 4. Quick Fleet Telemetry Watchlist */}
      <TelemetryWatchlist />

      {/* Modal for connecting device */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </>
  );
};
