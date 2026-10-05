import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Crosshair } from 'lucide-react';

interface QuickTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickTrackModal: React.FC<QuickTrackModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState('');

  if (!isOpen) return null;

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId.trim()) return;

    onClose();
    navigate(`/tracking/${encodeURIComponent(vehicleId.trim())}`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Crosshair size={20} color="#0284c7" />
            <span className="modal-title">Track Specific Vehicle by ID</span>
          </div>
          <button onClick={onClose} style={{ color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleTrack}>
          <div className="modal-body">
            <p style={{ fontSize: '0.84rem', color: '#475569' }}>
              Enter an existing chassis, vehicle, or GPS tracking unit ID to open the dedicated live telemetry telemetry HUD.
            </p>

            <div className="form-group">
              <label className="form-label">Vehicle or Hardware ID</label>
              <input
                type="text"
                required
                autoFocus
                className="form-input"
                placeholder="e.g. VH-001 or DEV-948201"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Search size={15} />
              <span>Initiate Tracking View</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
