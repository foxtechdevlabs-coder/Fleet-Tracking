import React, { useState } from 'react';
import { X, Plus, Radio, Cpu } from 'lucide-react';
import type { OperationalStatus } from '../../types/telemetry';
import { useFleet } from '../../context/FleetContext';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ isOpen, onClose }) => {
  const { addVehicle } = useFleet();

  const [vehicleId, setVehicleId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('Tata');
  const [model, setModel] = useState('Prima 4928.S');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>('MOVING');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) return;

    addVehicle({
      id: vehicleId.trim() || undefined,
      plateNumber: plateNumber.trim().toUpperCase(),
      make,
      model,
      driverName: driverName.trim() || 'Unassigned',
      driverPhone: driverPhone.trim() || undefined,
      deviceId: deviceId.trim() || `DEV-${Math.floor(100000 + Math.random() * 900000)}`,
      operationalStatus,
    });

    onClose();
    // Reset form
    setVehicleId('');
    setPlateNumber('');
    setDriverName('');
    setDriverPhone('');
    setDeviceId('');
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
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              fontSize: '0.78rem',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Radio size={16} color="#16a34a" />
              <span>Bonds an active GPS telemetry unit to an operational fleet chassis.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Vehicle ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. VH-001"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                />
              </div>

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
                <label className="form-label">Vehicle Make</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tata, Ashok Leyland"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model / Series</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Prima 4928.S"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Driver In Charge</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rajesh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Driver Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. +91 98401 23456"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">GPS Device IMEI / ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DEV-490218"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select
                  className="form-input"
                  value={operationalStatus}
                  onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
                >
                  <option value="MOVING">MOVING</option>
                  <option value="STOPPED">STOPPED</option>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} />
              <span>Bond & Activate Telemetry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
