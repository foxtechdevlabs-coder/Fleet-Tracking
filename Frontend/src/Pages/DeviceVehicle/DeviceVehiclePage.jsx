import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Cpu,
  Truck,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Radio
} from "lucide-react";
import "./DeviceVehiclePage.css";

function DeviceVehiclePage() {
  const navigate = useNavigate();

  // Controlled form state
  const [formData, setFormData] = useState({
    vehicleId: "",
    plateNumber: "",
    vehicleModel: "BharatBenz 2823R",
    vehicleType: "Heavy Hauler",
    driverName: "",
    deviceImei: "",
    deviceModel: "TELTONIKA-FMB120",
    simNumber: "",
    protocol: "Teltonika Codec 8",
    reportingInterval: "10"
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [apiError, setApiError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.vehicleId.trim()) errs.vehicleId = "Vehicle identifier is required (e.g. VH-029)";
    if (!formData.plateNumber.trim()) errs.plateNumber = "Registration plate number is required";
    if (!formData.driverName.trim()) errs.driverName = "Assigned driver name is required";
    if (!formData.deviceImei.trim()) {
      errs.deviceImei = "Hardware IMEI is required";
    } else if (!/^\d{15}$/.test(formData.deviceImei.trim())) {
      errs.deviceImei = "IMEI must be exactly 15 numeric digits";
    }
    if (!formData.simNumber.trim()) errs.simNumber = "M2M SIM number is required";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setSubmitSuccess(false);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      /*
       * BACKEND INTEGRATION HANDLER:
       * When backend endpoint is implemented, dispatch here:
       * const res = await fetch('/api/vehicles/register-with-device', {
       *   method: 'POST',
       *   headers: { 'Content-Type': 'application/json' },
       *   body: JSON.stringify(formData)
       * });
       */
      // Prepared handler simulation
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSubmitSuccess(true);
      // Reset form after short notice
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err) {
      setApiError(err.message || "Failed to provision device and vehicle.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="content">
      {/* Header */}
      <div className="provision-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-link">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <div className="section-label-row" style={{ marginTop: "8px" }}>
            <span className="section-label">TELEMETRY PROVISIONING</span>
            <span className="live-label">
              <Radio size={12} /> HARDWARE BONDING
            </span>
          </div>
          <h1>Device + Vehicle Registration</h1>
          <p>Pair and bond telemetry tracking hardware to active commercial fleet transports</p>
        </div>
      </div>

      {apiError && (
        <div className="error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{apiError}</span>
        </div>
      )}

      {submitSuccess && (
        <div className="success-banner" role="alert">
          <CheckCircle2 size={16} />
          <span>Vehicle and Telemetry unit successfully registered and bonded. Redirecting to Dashboard...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="provision-form" noValidate>
        <div className="provision-grid">
          {/* Vehicle Information Section */}
          <div className="provision-card">
            <div className="card-title-bar">
              <Truck size={16} className="card-icon" />
              <h3>Vehicle Specifications</h3>
            </div>

            <div className="fields-col">
              <div className={`field-group ${errors.vehicleId ? "field-error" : ""}`}>
                <label htmlFor="vehicleId">
                  Vehicle ID <span className="req">*</span>
                </label>
                <input
                  id="vehicleId"
                  name="vehicleId"
                  type="text"
                  placeholder="e.g. VH-029"
                  value={formData.vehicleId}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.vehicleId && <span className="err-text">{errors.vehicleId}</span>}
              </div>

              <div className={`field-group ${errors.plateNumber ? "field-error" : ""}`}>
                <label htmlFor="plateNumber">
                  Registration Plate Number <span className="req">*</span>
                </label>
                <input
                  id="plateNumber"
                  name="plateNumber"
                  type="text"
                  placeholder="e.g. TN 74 AB 9821"
                  value={formData.plateNumber}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.plateNumber && <span className="err-text">{errors.plateNumber}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="vehicleModel">Commercial Model</label>
                <select
                  id="vehicleModel"
                  name="vehicleModel"
                  value={formData.vehicleModel}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value="BharatBenz 2823R">BharatBenz 2823R (Heavy Hauler)</option>
                  <option value="Tata Prima 4028.S">Tata Prima 4028.S (Tractor Trailer)</option>
                  <option value="Ashok Leyland 1920">Ashok Leyland 1920 (Medium Cargo)</option>
                  <option value="Mahindra Blazo X">Mahindra Blazo X (Multi-Axle)</option>
                  <option value="Eicher Pro 3019">Eicher Pro 3019 (Container)</option>
                </select>
              </div>

              <div className={`field-group ${errors.driverName ? "field-error" : ""}`}>
                <label htmlFor="driverName">
                  Assigned Driver Name <span className="req">*</span>
                </label>
                <input
                  id="driverName"
                  name="driverName"
                  type="text"
                  placeholder="e.g. K. Sundarraj"
                  value={formData.driverName}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.driverName && <span className="err-text">{errors.driverName}</span>}
              </div>
            </div>
          </div>

          {/* Telemetry Hardware Device Section */}
          <div className="provision-card">
            <div className="card-title-bar">
              <Cpu size={16} className="card-icon" />
              <h3>Telemetry Hardware Unit</h3>
            </div>

            <div className="fields-col">
              <div className={`field-group ${errors.deviceImei ? "field-error" : ""}`}>
                <label htmlFor="deviceImei">
                  Hardware IMEI (15 Digits) <span className="req">*</span>
                </label>
                <input
                  id="deviceImei"
                  name="deviceImei"
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 863920194820192"
                  value={formData.deviceImei}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.deviceImei && <span className="err-text">{errors.deviceImei}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="deviceModel">Tracker Model</label>
                <select
                  id="deviceModel"
                  name="deviceModel"
                  value={formData.deviceModel}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value="TELTONIKA-FMB120">Teltonika FMB120 (CAN + GPS)</option>
                  <option value="TELTONIKA-FMB920">Teltonika FMB920 (Compact Basic)</option>
                  <option value="QUECLINK-GL300">Queclink GL300 (Standalone)</option>
                  <option value="CONCOX-GT06N">Concox GT06N (Standard Vehicle)</option>
                </select>
              </div>

              <div className={`field-group ${errors.simNumber ? "field-error" : ""}`}>
                <label htmlFor="simNumber">
                  M2M SIM Phone Number <span className="req">*</span>
                </label>
                <input
                  id="simNumber"
                  name="simNumber"
                  type="text"
                  placeholder="e.g. +91 98401 23456"
                  value={formData.simNumber}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.simNumber && <span className="err-text">{errors.simNumber}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="reportingInterval">Telemetry Transmit Interval</label>
                <select
                  id="reportingInterval"
                  name="reportingInterval"
                  value={formData.reportingInterval}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value="5">Every 5 seconds (High Frequency)</option>
                  <option value="10">Every 10 seconds (Standard Nominal)</option>
                  <option value="30">Every 30 seconds (Highway Economy)</option>
                  <option value="60">Every 60 seconds (Stationary Staging)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="form-submit-row">
          <Link to="/dashboard" className="cancel-btn">
            Cancel
          </Link>
          <button type="submit" className="save-provision-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="btn-spinner"></span>
                <span>Registering & Bonding Unit...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Register Device & Vehicle</span>
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}

export default DeviceVehiclePage;
