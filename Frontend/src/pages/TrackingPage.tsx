import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFleet } from '../context/FleetContext';
import { LiveTrackingView } from '../components/tracking/LiveTrackingView';

export const TrackingPage: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId?: string }>();
  const { selectedVehicleId, setSelectedVehicleId, refreshSingleVehicle } = useFleet();

  // Synchronize URL vehicle ID parameter without causing re-render loops or duplicate calls
  useEffect(() => {
    if (vehicleId && vehicleId !== selectedVehicleId) {
      setSelectedVehicleId(vehicleId);
      void refreshSingleVehicle(vehicleId);
    }
  }, [vehicleId, selectedVehicleId, setSelectedVehicleId, refreshSingleVehicle]);

  return <LiveTrackingView />;
};
