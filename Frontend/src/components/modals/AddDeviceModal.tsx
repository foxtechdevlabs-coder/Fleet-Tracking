import React, { useState } from 'react';
import { X, Plus, Radio, Cpu } from 'lucide-react';
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
      deviceId: deviceId.trim() || undefined,
      operationalStatus: 'UNKNOWN',
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
            <span className="modal-title">Add Vehicle Details</span>
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
              <span>This adds vehicle details to the current view. Status and location appear only after telemetry is received.</span>
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
                <label className="form-label">Telemetry Status</label>
                <input className="form-input" value="Awaiting telemetry" readOnly />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={16} />
              <span>Add Vehicle</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
