import { useState } from "react";
import "../App.css";
export default function App() {
  const [formData, setFormData] = useState({
    deviceId: "",
    deviceType: "",
    imeiSerial: "",
    phoneNumber: "",
    manufacturer: "",
    model: "",
    status: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    setErrors({
      ...errors,
      [name]: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.deviceId.trim()) {
      newErrors.deviceId = "Device ID is required";
    }

    if (!formData.deviceType) {
      newErrors.deviceType = "Device Type is required";
    }

    if (!formData.imeiSerial.trim()) {
      newErrors.imeiSerial = "IMEI / Serial Number is required";
    }

    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = "Manufacturer is required";
    }

    if (!formData.model.trim()) {
      newErrors.model = "Model is required";
    }

    if (!formData.status) {
      newErrors.status = "Status is required";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      alert("Device form is valid");
    }
  };

  return (
    <div className="container">
      <div className="form-card">
        <h1>Device Details</h1>
        <p className="subtitle">
          Add and configure a tracking device
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Device ID *</label>
            <input
              type="text"
              name="deviceId"
              placeholder="Enter Device ID"
              value={formData.deviceId}
              onChange={handleChange}
            />
            {errors.deviceId && (
              <span className="error">{errors.deviceId}</span>
            )}
          </div>

          <div className="form-group">
            <label>Device Type *</label>
            <select
              name="deviceType"
              value={formData.deviceType}
              onChange={handleChange}
            >
              <option value="">Select Device Type</option>
              <option value="GPS Tracker">GPS Tracker</option>
              <option value="OBD Tracker">OBD Tracker</option>
              <option value="Vehicle Tracker">Vehicle Tracker</option>
            </select>
            {errors.deviceType && (
              <span className="error">{errors.deviceType}</span>
            )}
          </div>

          <div className="form-group">
            <label>IMEI / Serial Number *</label>
            <input
              type="text"
              name="imeiSerial"
              placeholder="Enter IMEI or Serial Number"
              value={formData.imeiSerial}
              onChange={handleChange}
            />
            {errors.imeiSerial && (
              <span className="error">{errors.imeiSerial}</span>
            )}
          </div>

          <div className="form-group">
            <label>SIM / Phone Number</label>
            <input
              type="tel"
              name="phoneNumber"
              placeholder="Enter SIM / Phone Number"
              value={formData.phoneNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Manufacturer *</label>
            <input
              type="text"
              name="manufacturer"
              placeholder="Enter Manufacturer"
              value={formData.manufacturer}
              onChange={handleChange}
            />
            {errors.manufacturer && (
              <span className="error">{errors.manufacturer}</span>
            )}
          </div>

          <div className="form-group">
            <label>Model *</label>
            <input
              type="text"
              name="model"
              placeholder="Enter Device Model"
              value={formData.model}
              onChange={handleChange}
            />
            {errors.model && (
              <span className="error">{errors.model}</span>
            )}
          </div>

          <div className="form-group">
            <label>Status *</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="">Select Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            {errors.status && (
              <span className="error">{errors.status}</span>
            )}
          </div>

          <button type="submit">Save Device</button>
        </form>
      </div>
    </div>
  );
}