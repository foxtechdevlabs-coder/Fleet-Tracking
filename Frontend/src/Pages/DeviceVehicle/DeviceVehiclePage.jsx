import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Cpu, Edit3, Plus, RefreshCw, Trash2, Truck } from "lucide-react";
import "./DeviceVehiclePage.css";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState
} from "../../Components/Feedback/AsyncState";
import { useAuth } from "../../auth/AuthContext";
import {
  FleetApiError,
  createVehicleDevice,
  deleteDevice,
  deleteVehicle,
  listDevices,
  listVehicles,
  updateDevice,
  updateVehicle
} from "../../services/fleetApi";

const initialForm = {
  deviceId: "",
  deviceStatus: "active",
  registrationNumber: "",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleStatus: "active"
};

const textValue = (value) => typeof value === "string" || typeof value === "number" ? String(value) : "";

function mapRecords(devices, vehicles) {
  const vehicleById = new Map(vehicles.map((vehicle) => [textValue(vehicle.id), vehicle]));
  const linkedVehicleIds = new Set();
  const records = devices.map((device) => {
    const vehicle = vehicleById.get(textValue(device.vehicleId));
    if (vehicle) linkedVehicleIds.add(textValue(vehicle.id));
    return {
      id: textValue(device.id),
      deviceRecordId: textValue(device.id),
      vehicleRecordId: textValue(vehicle?.id),
      deviceId: textValue(device.identifier),
      deviceStatus: textValue(device.status),
      registrationNumber: textValue(vehicle?.plateNumber),
      vehicleYear: textValue(vehicle?.year),
      vehicleMake: textValue(vehicle?.make),
      vehicleModel: textValue(vehicle?.model),
      vehicleStatus: textValue(vehicle?.status),
      updatedAt: textValue(vehicle?.updatedAt) || textValue(device.updatedAt)
    };
  });
  vehicles.forEach((vehicle) => {
    if (linkedVehicleIds.has(textValue(vehicle.id))) return;
    records.push({
      id: textValue(vehicle.id),
      deviceRecordId: "",
      vehicleRecordId: textValue(vehicle.id),
      deviceId: "",
      deviceStatus: "",
      registrationNumber: textValue(vehicle.plateNumber),
      vehicleYear: textValue(vehicle.year),
      vehicleMake: textValue(vehicle.make),
      vehicleModel: textValue(vehicle.model),
      vehicleStatus: textValue(vehicle.status),
      updatedAt: textValue(vehicle.updatedAt)
    });
  });
  return records;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function DeviceVehiclePage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [editingRecord, setEditingRecord] = useState(null);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError("");
    setIsUnauthorized(false);
    Promise.all([listDevices(session, controller.signal), listVehicles(session, controller.signal)])
      .then(([devices, vehicles]) => setRecords(mapRecords(devices, vehicles)))
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
        else setLoadError(error instanceof Error ? error.message : "Unable to load fleet records.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [retryCount, session]);

  const handleUnauthorized = async () => {
    try { await logout(); } finally { navigate("/login", { replace: true }); }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setFeedback("");
  };

  const validate = () => {
    const nextErrors = {};
    if (!editingRecord && !formData.deviceId.trim()) nextErrors.deviceId = "Device identifier is required.";
    if (formData.deviceId.trim().length > 100) nextErrors.deviceId = "Device identifier must be 100 characters or fewer.";
    if (!formData.registrationNumber.trim()) nextErrors.registrationNumber = "Registration number is required.";
    if (!formData.vehicleMake.trim()) nextErrors.vehicleMake = "Vehicle make is required.";
    if (!formData.vehicleModel.trim()) nextErrors.vehicleModel = "Vehicle model is required.";
    if (!Number.isInteger(Number(formData.vehicleYear)) || Number(formData.vehicleYear) < 1900 || Number(formData.vehicleYear) > 2100) nextErrors.vehicleYear = "Vehicle year must be an integer from 1900 to 2100.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingRecord(null);
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    setFeedback("");
    const vehiclePayload = {
      plateNumber: formData.registrationNumber.trim().toUpperCase(),
      make: formData.vehicleMake.trim(),
      model: formData.vehicleModel.trim(),
      year: Number(formData.vehicleYear),
      status: formData.vehicleStatus
    };
    const devicePayload = { identifier: formData.deviceId.trim(), status: formData.deviceStatus };
    try {
      if (editingRecord) {
        await Promise.all([
          updateDevice(session, editingRecord.deviceRecordId, devicePayload),
          updateVehicle(session, editingRecord.vehicleRecordId, vehiclePayload)
        ]);
        setFeedback("Device and vehicle updated successfully.");
      } else {
        await createVehicleDevice(session, { vehicle: vehiclePayload, device: devicePayload });
        setFeedback("Device and vehicle registered successfully.");
      }
      resetForm();
      setRetryCount((count) => count + 1);
    } catch (error) {
      if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
      else setFeedback(error instanceof Error ? error.message : "The request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (record) => {
    if (!record.deviceRecordId || !record.vehicleRecordId) {
      setFeedback("Both a device and vehicle record are required before editing this row.");
      return;
    }
    setEditingRecord(record);
    setFormData({
      deviceId: record.deviceId,
      deviceStatus: record.deviceStatus || "active",
      registrationNumber: record.registrationNumber,
      vehicleYear: record.vehicleYear,
      vehicleMake: record.vehicleMake,
      vehicleModel: record.vehicleModel,
      vehicleStatus: record.vehicleStatus || "active"
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (record, type) => {
    const id = type === "device" ? record.deviceRecordId : record.vehicleRecordId;
    if (!id || !window.confirm(`Delete this ${type}? This action cannot be undone.`)) return;
    try {
      if (type === "device") await deleteDevice(session, id);
      else await deleteVehicle(session, id);
      setFeedback(`${type === "device" ? "Device" : "Vehicle"} deleted successfully.`);
      setRetryCount((count) => count + 1);
    } catch (error) {
      if (error instanceof FleetApiError && error.status === 401) setIsUnauthorized(true);
      else setFeedback(error instanceof Error ? error.message : "Delete failed. Please try again.");
    }
  };

  return (
    <main className="content">
      <div className="provision-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-link"><ArrowLeft size={14} /> Back to Dashboard</Link>
          <div className="section-label">DEVICE + VEHICLE REGISTRY</div>
          <h1>{editingRecord ? "Edit Device + Vehicle" : "Device + Vehicle Registration"}</h1>
          <p>Manage registered vehicles and their GPS device assignments.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => setRetryCount((count) => count + 1)} disabled={isLoading}><RefreshCw size={14} /> Refresh</button>
      </div>
      {feedback && <ErrorState className="error-banner" message={feedback} />}
      {isUnauthorized ? <UnauthorizedState action={handleUnauthorized} /> : loadError ? <ErrorState message={loadError} onRetry={() => setRetryCount((count) => count + 1)} /> : (
        <>
          <form onSubmit={handleSubmit} className="provision-form" noValidate>
            <div className="provision-grid">
              <div className="provision-card">
                <div className="card-title-bar"><Truck size={16} className="card-icon" /><h3>Vehicle Information</h3></div>
                <div className="fields-col">
                  <Field label="Registration Number" name="registrationNumber" value={formData.registrationNumber} error={errors.registrationNumber} onChange={handleChange} placeholder="e.g. TN 74 AB 9821" />
                  <Field label="Vehicle Make" name="vehicleMake" value={formData.vehicleMake} error={errors.vehicleMake} onChange={handleChange} placeholder="e.g. Tata" />
                  <Field label="Vehicle Model" name="vehicleModel" value={formData.vehicleModel} error={errors.vehicleModel} onChange={handleChange} placeholder="e.g. Prima 4028.S" />
                  <Field label="Vehicle Year" name="vehicleYear" type="number" value={formData.vehicleYear} error={errors.vehicleYear} onChange={handleChange} placeholder="e.g. 2024" />
                  <SelectField label="Vehicle Status" name="vehicleStatus" value={formData.vehicleStatus} onChange={handleChange} options={["active", "inactive", "maintenance"]} />
                </div>
              </div>
              <div className="provision-card">
                <div className="card-title-bar"><Cpu size={16} className="card-icon" /><h3>GPS Device</h3></div>
                <div className="fields-col">
                  <Field label="Device Identifier" name="deviceId" value={formData.deviceId} error={errors.deviceId} onChange={handleChange} placeholder="e.g. GPS-001" disabled={Boolean(editingRecord)} />
                  <SelectField label="Device Status" name="deviceStatus" value={formData.deviceStatus} onChange={handleChange} options={["active", "inactive"]} />
                </div>
              </div>
            </div>
            <div className="form-submit-row">
              {editingRecord && <button type="button" className="cancel-btn" onClick={resetForm}>Cancel edit</button>}
              <button type="submit" className="save-provision-btn" disabled={isSubmitting}>{isSubmitting ? <span className="btn-spinner" /> : <Plus size={16} />}<span>{editingRecord ? "Save Changes" : "Register Device + Vehicle"}</span></button>
            </div>
          </form>
          <section className="registry-section" aria-labelledby="registry-title">
            <div className="registry-heading"><div><div className="section-label">CONNECTED ASSETS</div><h2 id="registry-title">Registered Devices and Vehicles</h2></div><span className="record-count">{records.length} records</span></div>
            {isLoading ? <LoadingState message="Loading devices and vehicles..." /> : records.length === 0 ? <EmptyState title="No devices or vehicles registered" message="Registered assets will appear here after the first successful API response." /> : (
              <div className="registry-table-wrap"><table className="registry-table"><thead><tr><th>Device</th><th>Vehicle</th><th>Make / Model</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {records.map((record) => <tr key={`${record.deviceRecordId || "vehicle"}-${record.vehicleRecordId}`}><td><strong>{record.deviceId || "Unassigned"}</strong><small>{record.deviceStatus || "-"}</small></td><td><strong>{record.registrationNumber || "Unassigned"}</strong><small>{record.vehicleYear || "-"}</small></td><td>{[record.vehicleMake, record.vehicleModel].filter(Boolean).join(" ") || "-"}</td><td><span className="status-badge">{record.vehicleStatus || record.deviceStatus || "-"}</span></td><td>{formatDate(record.updatedAt)}</td><td><div className="row-actions"><button type="button" title="Edit linked records" aria-label="Edit linked records" onClick={() => startEditing(record)}><Edit3 size={14} /></button><button type="button" title="Delete device" aria-label="Delete device" onClick={() => handleDelete(record, "device")} disabled={!record.deviceRecordId}><Trash2 size={14} /></button><button type="button" title="Delete vehicle" aria-label="Delete vehicle" onClick={() => handleDelete(record, "vehicle")} disabled={!record.vehicleRecordId}><Truck size={14} /></button></div></td></tr>)}
              </tbody></table></div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Field({ label, name, value, error, onChange, type = "text", placeholder, disabled = false }) {
  return <div className={`field-group ${error ? "field-error" : ""}`}><label htmlFor={name}>{label} <span className="req">*</span></label><input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />{error && <span className="err-text">{error}</span>}</div>;
}

function SelectField({ label, name, value, onChange, options }) {
  return <div className="field-group"><label htmlFor={name}>{label}</label><select id={name} name={name} value={value} onChange={onChange}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}

export default DeviceVehiclePage;
