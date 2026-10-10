import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFleet } from '../context/FleetContext';
import { LiveTrackingView } from '../components/tracking/LiveTrackingView';

export const TrackingPage: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId?: string }>();
  const { setSelectedVehicleId } = useFleet();

  useEffect(() => {
    if (vehicleId) {
      setSelectedVehicleId(vehicleId);
    }
  }, [vehicleId, setSelectedVehicleId]);

  return <LiveTrackingView />;
};
