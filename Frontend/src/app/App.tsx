import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "../App.css";

type CreationForm = {
  deviceId: string;
  deviceType: string;
  imeiSerial: string;
  phoneNumber: string;
  manufacturer: string;
  deviceModel: string;
  status: string;
  registration: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vin: string;
};

type FieldName = keyof CreationForm;

const emptyForm: CreationForm = {
  deviceId: "",
  deviceType: "",
  imeiSerial: "",
  phoneNumber: "",
  manufacturer: "",
  deviceModel: "",
  status: "",
  registration: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  vin: "",
};

const requiredFields: FieldName[] = [
  "deviceId",
  "deviceType",
  "imeiSerial",
  "manufacturer",
  "deviceModel",
  "status",
  "registration",
  "vehicleMake",
  "vehicleModel",
];

const fieldNames: FieldName[] = [
  "deviceId",
  "deviceType",
  "imeiSerial",
  "phoneNumber",
  "manufacturer",
  "deviceModel",
  "status",
  "registration",
  "vehicleMake",
  "vehicleModel",
  "vehicleYear",
  "vin",
];

const fieldLabels: Record<FieldName, string> = {
  deviceId: "Device ID",
  deviceType: "Device type",
  imeiSerial: "IMEI / serial number",
  phoneNumber: "SIM / phone number",
  manufacturer: "Manufacturer",
  deviceModel: "Device model",
  status: "Device status",
  registration: "Registration number",
  vehicleMake: "Vehicle make",
  vehicleModel: "Vehicle model",
  vehicleYear: "Year",
  vin: "VIN",
};

function App() {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreationForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [apiNotice, setApiNotice] = useState(false);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    const field = fieldNames.find((fieldName) => fieldName === name);

    if (!field) {
      throw new Error(`Unexpected form field: ${name}`);
    }

    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiNotice(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Partial<Record<FieldName, string>> = {};
    for (const field of requiredFields) {
      if (!formData[field].trim()) {
        nextErrors[field] = `${fieldLabels[field]} is required`;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setApiNotice(true);
    }
  };

  const openCreationForm = () => {
    setFormData(emptyForm);
    setErrors({});
    setApiNotice(false);
    setIsCreating(true);
  };

  const returnToDevices = () => {
    setIsCreating(false);
    setErrors({});
    setApiNotice(false);
  };

  const renderInput = (
    name: FieldName,
    placeholder: string,
    options: { type?: string; required?: boolean; min?: string; max?: string } = {},
  ) => (
    <div className="field" key={name}>
      <label htmlFor={name}>
        {fieldLabels[name]}
        {options.required && <span className="required-mark"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={options.type ?? "text"}
        placeholder={placeholder}
        value={formData[name]}
        onChange={handleChange}
        min={options.min}
        max={options.max}
        required={options.required}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
      {errors[name] && (
        <span className="field-error" id={`${name}-error`} role="alert">
          {errors[name]}
        </span>
      )}
    </div>
  );

  const renderSelect = (
    name: FieldName,
    placeholder: string,
    options: string[],
  ) => (
    <div className="field" key={name}>
      <label htmlFor={name}>
        {fieldLabels[name]}
        <span className="required-mark"> *</span>
      </label>
      <select
        id={name}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        required
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
      {errors[name] && (
        <span className="field-error" id={`${name}-error`} role="alert">
          {errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#devices"
          onClick={(event) => {
            event.preventDefault();
            returnToDevices();
          }}
          aria-label="FleetTrack home"
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M4 16.5h16M6.5 16.5l1.2-5.1a2 2 0 0 1 1.95-1.54h4.7a2 2 0 0 1 1.95 1.54l1.2 5.1M7 16.5v2m10-2v2M8.5 13.5h7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="16.5" r="1.25" fill="currentColor" />
              <circle cx="16" cy="16.5" r="1.25" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-name">fleet<span>track</span></span>
        </a>
        <div className="topbar-right">
          <span className="workspace-label">Fleet workspace</span>
          <span className="avatar" aria-label="Account">A</span>
        </div>
      </header>

      <main className="page-content">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <span>Fleet management</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
          <span className={isCreating ? "" : "breadcrumb-current"}>
            Devices
          </span>
          {isCreating && (
            <>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 3 5 5-5 5" />
              </svg>
              <span className="breadcrumb-current">Add device</span>
            </>
          )}
        </nav>

        {!isCreating ? (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">FLEET MANAGEMENT</p>
                <h1>Devices</h1>
                <p className="page-description">
                  Manage tracking devices and the vehicles they monitor.
                </p>
              </div>
              <button className="primary-button" onClick={openCreationForm}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                Add Device
              </button>
            </section>

            <section className="registry-card" aria-label="Device list">
              <div className="registry-header">
                <div>
                  <h2>Device registry</h2>
                  <p>Your tracking equipment will appear here</p>
                </div>
              </div>
              <div className="empty-state">
                <div className="empty-illustration" aria-hidden="true">
                  <span className="illustration-ring ring-one" />
                  <span className="illustration-ring ring-two" />
                  <span className="illustration-tile">
                    <svg viewBox="0 0 48 48" fill="none">
                      <rect
                        x="9"
                        y="10"
                        width="30"
                        height="28"
                        rx="7"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M17 18h14M17 24h14M17 30h8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="34" cy="32" r="7" fill="#fff" />
                      <path
                        d="M34 28.8v6.4m-3.2-3.2h6.4"
                        stroke="#2563eb"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
                <h3>No devices yet</h3>
                <p>
                  Add a tracking device and its vehicle details together to get
                  your fleet set up.
                </p>
                <button className="secondary-button" onClick={openCreationForm}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M10 4v12M4 10h12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  Add your first device
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="page-heading create-heading">
              <div>
                <button className="back-link" onClick={returnToDevices}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M15.8 10H4.2m0 0 5-5m-5 5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back to devices
                </button>
                <p className="eyebrow">NEW FLEET ASSET</p>
                <h1>Add device &amp; vehicle</h1>
                <p className="page-description">
                  Enter the tracking device and vehicle information in one
                  place.
                </p>
              </div>
            </section>

            <form className="creation-card" onSubmit={handleSubmit} noValidate>
              <section className="form-section">
                <div className="section-heading">
                  <span className="section-icon device-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect
                        x="5"
                        y="3.5"
                        width="14"
                        height="17"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M9 8h6m-6 4h6m-6 4h3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <h2>Device details</h2>
                    <p>Identification and configuration of the tracker</p>
                  </div>
                </div>
                <div className="form-grid">
                  {renderInput("deviceId", "e.g. DEV-1042", { required: true })}
                  {renderSelect("deviceType", "Choose a device type", [
                    "GPS Tracker",
                    "OBD Tracker",
                    "Vehicle Tracker",
                  ])}
                  {renderInput("imeiSerial", "Enter IMEI or serial number", {
                    required: true,
                  })}
                  {renderInput("phoneNumber", "e.g. +1 555 010 2040", {
                    type: "tel",
                  })}
                  {renderInput("manufacturer", "e.g. Teltonika", {
                    required: true,
                  })}
                  {renderInput("deviceModel", "e.g. FMC920", {
                    required: true,
                  })}
                  {renderSelect("status", "Choose a status", [
                    "Active",
                    "Inactive",
                    "Maintenance",
                  ])}
                </div>
              </section>

              <section className="form-section vehicle-section">
                <div className="section-heading">
                  <span className="section-icon vehicle-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="m5 11 1.5-4.2A2 2 0 0 1 8.4 5.5h7.2a2 2 0 0 1 1.9 1.3L19 11m-14 0h14a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 5 11Zm1 7v1.5m12-1.5v1.5M7 14.5h.01M17 14.5h.01"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <h2>Vehicle details</h2>
                    <p>Vehicle monitored by this device</p>
                  </div>
                </div>
                <div className="form-grid">
                  {renderInput("registration", "e.g. ABC 1234", {
                    required: true,
                  })}
                  {renderInput("vehicleMake", "e.g. Toyota", {
                    required: true,
                  })}
                  {renderInput("vehicleModel", "e.g. Hilux", {
                    required: true,
                  })}
                  {renderInput("vehicleYear", "e.g. 2024", {
                    type: "number",
                    min: "1900",
                    max: "2100",
                  })}
                  {renderInput("vin", "Enter vehicle identification number")}
                </div>
              </section>

              {apiNotice && (
                <p className="api-notice" role="status">
                  The creation API is not connected yet. Your details have not
                  been saved.
                </p>
              )}

              <div className="form-actions">
                <button
                  className="cancel-button"
                  type="button"
                  onClick={returnToDevices}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save device &amp; vehicle
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4.2 10h11.6m0 0-5-5m5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
