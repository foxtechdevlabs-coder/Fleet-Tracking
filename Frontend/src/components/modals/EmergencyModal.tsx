import React, { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';
import { useFleet } from '../../context/FleetContext';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose }) => {
  const { triggerEmergencyBroadcast } = useFleet();
  const [broadcastText, setBroadcastText] = useState('Severe weather warning: Cyclone alert along NH-45. All active bonded vehicles maintain safe distance or halt at nearest logistics depot.');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    triggerEmergencyBroadcast(broadcastText.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottomColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#ef4444" />
            <span className="modal-title" style={{ color: '#991b1b' }}>Emergency Telematics Broadcast</span>
          </div>
          <button onClick={onClose} style={{ color: '#991b1b' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSend}>
          <div className="modal-body">
            <p style={{ fontSize: '0.82rem', color: '#475569' }}>
              Broadcast a high-priority push directive across all bonded telemetry units and driver cab consoles.
            </p>

            <div className="form-group">
              <label className="form-label">Broadcast Alert Directive</label>
              <textarea
                className="form-input"
                rows={4}
                required
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: '0.74rem',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={16} />
              <span>This command immediately overrides active vehicle navigation consoles.</span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-danger">
              <Send size={15} />
              <span>Transmit Broadcast</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
