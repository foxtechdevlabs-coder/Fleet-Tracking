import React, { useState } from 'react';
import { X, Plus, Radio, Cpu } from 'lucide-react';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ isOpen, onClose }) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [deviceId, setDeviceId] = useState('');
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationError('Registration requires administrator sign-in, which is not available in this frontend. No vehicle or device was created.');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="#0284c7" />
            <span className="modal-title">Connect Device & Register Vehicle</span>
          </div>
          <button onClick={onClose} style={{ color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              fontSize: '0.78rem',
              color: '#9a3412',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Radio size={16} color="#c2410c" />
              <span>Administrator sign-in is required by the registration API. This form will not create local or simulated records.</span>
            </div>
            {registrationError && <p role="alert" style={{ color: '#b91c1c' }}>{registrationError}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Registration Plate *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. TN 74 AB 1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Vehicle Make *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Tata, Ashok Leyland"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model / Series *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Prima 4928.S"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Model Year *</label>
                <input
                  type="number"
                  required
                  className="form-input"
                  min="1900"
                  max="2100"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GPS Device IMEI / ID *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. DEV-490218"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} />
              <span>Register Vehicle &amp; Device</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
