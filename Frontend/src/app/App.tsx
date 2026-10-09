import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import "../App.css";

type DeviceVehicleRecord = {
  id: string;
  deviceId: string;
  deviceType: string;
  imeiSerial: string;
  simMsisdn: string;
  manufacturer: string;
  hardwareModel: string;
  deviceStatus: string;
  vehicleId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleLabel: string;
  driverName: string;
  driverContact: string;
  createdAt: string;
};

type CreationForm = {
  deviceId: string;
  deviceType: string;
  imeiSerial: string;
  simMsisdn: string;
  manufacturer: string;
  hardwareModel: string;
  deviceStatus: string;
  vehicleId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleLabel: string;
  driverName: string;
  driverContact: string;
};

type FormErrors = Partial<Record<keyof CreationForm, string>>;

const initialForm: CreationForm = {
  deviceId: "",
  deviceType: "Hardwired GPS",
  imeiSerial: "",
  simMsisdn: "",
  manufacturer: "",
  hardwareModel: "",
  deviceStatus: "Active",
  vehicleId: "",
  registrationNumber: "",
  vehicleType: "Heavy Truck",
  vehicleLabel: "",
  driverName: "",
  driverContact: "",
};

const initialRecords: DeviceVehicleRecord[] = [
  {
    id: "rec-1",
    deviceId: "GPS-001",
    deviceType: "Hardwired GPS",
    imeiSerial: "864201048892100",
    simMsisdn: "+91 98840 11223",
    manufacturer: "Teltonika Telematics",
    hardwareModel: "FMB920",
    deviceStatus: "Active",
    vehicleId: "VH-001",
    registrationNumber: "TN 74 AB 1234",
    vehicleType: "Heavy Truck",
    vehicleLabel: "Tata Prima 4028.S",
    driverName: "R. Saravanan",
    driverContact: "+91 94432 10987",
    createdAt: "2026-09-26 11:30 AM",
  },
  {
    id: "rec-2",
    deviceId: "GPS-002",
    deviceType: "OBD Tracker",
    imeiSerial: "864201048892105",
    simMsisdn: "+91 98840 55667",
    manufacturer: "Teltonika Telematics",
    hardwareModel: "FMC130",
    deviceStatus: "Active",
    vehicleId: "VH-002",
    registrationNumber: "TN 75 CD 5678",
    vehicleType: "Express Van",
    vehicleLabel: "Express Van LCV",
    driverName: "K. Anbarasan",
    driverContact: "+91 98401 23456",
    createdAt: "2026-09-26 11:35 AM",
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<"fleet" | "dashboard" | "live" | "history" | "reports" | "settings">("fleet");
  const [records, setRecords] = useState<DeviceVehicleRecord[]>(initialRecords);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreationForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [apiSuccessMessage, setApiSuccessMessage] = useState<string | null>(null);

  // Live dynamic clock in Asia/Kolkata timezone (IST)
  const [currentTime, setCurrentTime] = useState(() => {
    return (
      new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " IST"
    );
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-GB", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " IST"
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter records based on search query
  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      rec.deviceId.toLowerCase().includes(q) ||
      rec.registrationNumber.toLowerCase().includes(q) ||
      rec.vehicleId.toLowerCase().includes(q) ||
      rec.driverName.toLowerCase().includes(q) ||
      rec.deviceType.toLowerCase().includes(q) ||
      rec.hardwareModel.toLowerCase().includes(q) ||
      rec.vehicleLabel.toLowerCase().includes(q) ||
      rec.imeiSerial.includes(q)
    );
  });

  // Auto-generate Vehicle ID when Device ID changes if Vehicle ID hasn't been manually edited
  const handleDeviceIdChange = (value: string) => {
    const trimmed = value.trim();
    let autoVehicleId = formData.vehicleId;
    
    if (trimmed.toUpperCase().startsWith("GPS-")) {
      autoVehicleId = "VH-" + trimmed.slice(4);
    } else if (trimmed) {
      autoVehicleId = "VH-" + trimmed;
    }

    setFormData((prev) => ({
      ...prev,
      deviceId: value,
      vehicleId: prev.vehicleId === "" || prev.vehicleId.startsWith("VH-") ? autoVehicleId : prev.vehicleId,
    }));

    if (errors.deviceId) {
      setErrors((prev) => ({ ...prev, deviceId: undefined, vehicleId: undefined }));
    }
  };

  const handleInputChange = (field: keyof CreationForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiErrorMessage(null);
  };

  const isPayloadValid =
    Boolean(formData.deviceId.trim()) &&
    Boolean(formData.deviceType) &&
    /^\d{15}$/.test(formData.imeiSerial.trim().replace(/[-\s]/g, "")) &&
    /^\+?[\d\s-]{10,15}$/.test(formData.simMsisdn.trim()) &&
    Boolean(formData.manufacturer.trim()) &&
    Boolean(formData.hardwareModel.trim()) &&
    Boolean(formData.deviceStatus) &&
    Boolean(formData.vehicleId.trim()) &&
    Boolean(formData.registrationNumber.trim()) &&
    Boolean(formData.vehicleType) &&
    (!formData.driverContact.trim() || /^\+?[\d\s-]{10,15}$/.test(formData.driverContact.trim()));

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Device Master Validation (Tasks 6-10)
    if (!formData.deviceId.trim()) {
      newErrors.deviceId = "Device ID is required (e.g., GPS-049)";
    }
    if (!formData.deviceType) {
      newErrors.deviceType = "Device Type is required";
    }
    if (!formData.imeiSerial.trim()) {
      newErrors.imeiSerial = "IMEI / Serial Number is required";
    } else if (!/^\d{15}$/.test(formData.imeiSerial.trim().replace(/[-\s]/g, ""))) {
      newErrors.imeiSerial = "IMEI must be exactly 15 digits";
    }
    if (!formData.simMsisdn.trim()) {
      newErrors.simMsisdn = "SIM / Phone Number is required";
    } else if (!/^\+?[\d\s-]{10,15}$/.test(formData.simMsisdn.trim())) {
      newErrors.simMsisdn = "Enter a valid SIM MSISDN (+91 format)";
    }
    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = "Manufacturer is required";
    }
    if (!formData.hardwareModel.trim()) {
      newErrors.hardwareModel = "Hardware Model is required";
    }
    if (!formData.deviceStatus) {
      newErrors.deviceStatus = "Device Status is required";
    }

    // Vehicle Details Validation (Tasks 11-15)
    if (!formData.vehicleId.trim()) {
      newErrors.vehicleId = "Vehicle ID is required (e.g., VH-049)";
    }
    if (!formData.registrationNumber.trim()) {
      newErrors.registrationNumber = "Registration Number is required";
    }
    if (!formData.vehicleType) {
      newErrors.vehicleType = "Vehicle Type is required";
    }
    if (formData.driverContact.trim() && !/^\+?[\d\s-]{10,15}$/.test(formData.driverContact.trim())) {
      newErrors.driverContact = "Invalid driver contact format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenModal = () => {
    setFormData(initialForm);
    setErrors({});
    setApiErrorMessage(null);
    setApiSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setErrors({});
    setApiErrorMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Prepare strict payload matching backend allowKeys schema (Tasks 21-24):
    // backend expects { vehicle: { plateNumber, make, model, year, status }, device: { identifier, status } }
    const apiPayload = {
      vehicle: {
        plateNumber: formData.registrationNumber.trim().toUpperCase(),
        make: formData.manufacturer.trim() || "Teltonika Telematics",
        model: formData.vehicleLabel.trim() || formData.vehicleType || "Heavy Truck",
        year: new Date().getFullYear(),
        status: formData.deviceStatus.toLowerCase() === "active" ? "active" : "inactive",
      },
      device: {
        identifier: formData.deviceId.trim(),
        status: formData.deviceStatus.toLowerCase() === "active" ? "active" : "inactive",
      },
    };

    try {
      // Try backend endpoint first
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/setup/vehicle-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        // Map HTTP status codes explicitly as specified in Tasks 30-33
        let errorMsg = "";
        let responseJson: any = null;
        try {
          responseJson = await response.json();
        } catch {
          // Response was not JSON
        }

        const serverMessage = responseJson?.message || responseJson?.error || "";

        switch (response.status) {
          case 400:
            errorMsg = serverMessage || "Validation Error (400): Invalid payload format or unsupported fields.";
            break;
          case 401:
            errorMsg = serverMessage || "Unauthorized (401): Admin credentials required to add assets.";
            break;
          case 403:
            errorMsg = serverMessage || "Forbidden (403): You do not have permissions for asset creation.";
            break;
          case 404:
            errorMsg = serverMessage || "Not Found (404): Creation endpoint not found.";
            break;
          case 405:
            errorMsg = serverMessage || "Method Not Allowed (405): POST action rejected.";
            break;
          case 409:
            errorMsg = serverMessage || "Conflict (409): Device ID or Vehicle Registration Number already exists.";
            break;
          case 500:
          default:
            errorMsg = serverMessage || `Server Error (${response.status}): Could not create asset setup.`;
            break;
        }

        setApiErrorMessage(errorMsg);
        setIsSubmitting(false);
        // Task 34: Ensure failed creation does not create incorrect frontend records
        return;
      }

      const resData = await response.json();
      
      // Tasks 25-29: Map response correctly with null/undefined safety
      const returnedData = resData?.data ?? resData;
      const returnedVehicle = returnedData?.vehicle ?? {};
      const returnedDevice = returnedData?.device ?? {};

      const newRecord: DeviceVehicleRecord = {
        id: returnedDevice?.id ?? `rec-${Date.now()}`,
        deviceId: returnedDevice?.identifier ?? formData.deviceId.trim(),
        deviceType: formData.deviceType,
        imeiSerial: formData.imeiSerial.trim(),
        simMsisdn: formData.simMsisdn.trim(),
        manufacturer: formData.manufacturer.trim(),
        hardwareModel: formData.hardwareModel.trim(),
        deviceStatus: returnedDevice?.status ? returnedDevice.status.charAt(0).toUpperCase() + returnedDevice.status.slice(1) : formData.deviceStatus,
        vehicleId: formData.vehicleId.trim(),
        registrationNumber: returnedVehicle?.plateNumber ?? formData.registrationNumber.trim().toUpperCase(),
        vehicleType: formData.vehicleType,
        vehicleLabel: formData.vehicleLabel.trim() || returnedVehicle?.model || `${formData.vehicleType}`,
        driverName: formData.driverName.trim() || "Unassigned",
        driverContact: formData.driverContact.trim() || "-",
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " IST",
      };

      setRecords((prev) => [newRecord, ...prev]);
      setApiSuccessMessage(`Device (${newRecord.deviceId}) & Vehicle (${newRecord.vehicleId}) linked and saved successfully!`);
      setIsSubmitting(false);
      setIsModalOpen(false);

    } catch (networkError: any) {
      // If API server is not running or unreachable (Task 5 & Task 10: Standalone UI Mode)
      console.warn("API server call failed or unavailable, operating in standalone UI mode:", networkError);
      
      // Complete creation locally safely without corrupting backend state
      const newRecord: DeviceVehicleRecord = {
        id: `rec-${Date.now()}`,
        deviceId: formData.deviceId.trim(),
        deviceType: formData.deviceType,
        imeiSerial: formData.imeiSerial.trim(),
        simMsisdn: formData.simMsisdn.trim(),
        manufacturer: formData.manufacturer.trim(),
        hardwareModel: formData.hardwareModel.trim(),
        deviceStatus: formData.deviceStatus,
        vehicleId: formData.vehicleId.trim(),
        registrationNumber: formData.registrationNumber.trim().toUpperCase(),
        vehicleType: formData.vehicleType,
        vehicleLabel: formData.vehicleLabel.trim() || `${formData.vehicleType}`,
        driverName: formData.driverName.trim() || "Unassigned",
        driverContact: formData.driverContact.trim() || "-",
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " IST",
      };

      setRecords((prev) => [newRecord, ...prev]);
      setApiSuccessMessage(`Device (${newRecord.deviceId}) & Vehicle (${newRecord.vehicleId}) enrolled locally (Offline UI Mode).`);
      setIsSubmitting(false);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <a href="#home" className="brand" aria-label="FleetTrack Dashboard">
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
            <span className="brand-name">
              Fleet<span>Track</span>
            </span>
          </a>
          <span className="phase-badge">PHASE 1</span>
          <span className="console-path">Console &gt; <strong>Fleet Telematics</strong></span>
        </div>

        <div className="topbar-right">
          <div className="status-indicator">
            <span className="pulse-dot"></span>
            <span>Realtime Connected</span>
          </div>
          <div className="time-badge">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4v4l2.5 2.5" />
            </svg>
            <span>{currentTime}</span>
            <small>Asia/Kolkata</small>
          </div>
          <div className="user-profile">
            <span className="avatar">AM</span>
            <div className="user-info">
              <span className="user-name">Alex Morgan</span>
              <span className="user-role">Fleet Admin</span>
            </div>
            <button className="exit-button" title="Exit Console">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" />
              </svg>
              Exit
            </button>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* Left Sidebar Navigation */}
        <aside className="sidebar">
          <p className="sidebar-label">OPERATIONAL FLEET MENU</p>
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="6" height="6" rx="1.5" />
                <rect x="11" y="3" width="6" height="6" rx="1.5" />
                <rect x="3" y="11" width="6" height="6" rx="1.5" />
                <rect x="11" y="11" width="6" height="6" rx="1.5" />
              </svg>
              Dashboard
            </button>
            <button
              className={`nav-item ${activeTab === "fleet" ? "active" : ""}`}
              onClick={() => setActiveTab("fleet")}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 7l7-4 7 4v8l-7 4-7-4V7z" />
                <path d="M3 7l7 4 7-4" />
                <path d="M10 11v8" />
              </svg>
              Fleet
            </button>
            <button
              className={`nav-item ${activeTab === "live" ? "active" : ""}`}
              onClick={() => setActiveTab("live")}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="10" cy="10" r="3" />
                <path d="M3 10a7 7 0 0 1 14 0" />
                <path d="M1 10a9 9 0 0 1 18 0" />
              </svg>
              Live Tracking
            </button>
            <button
              className={`nav-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M10 4v6l4 2" />
                <circle cx="10" cy="10" r="7" />
              </svg>
              History
            </button>
            <button
              className={`nav-item ${activeTab === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 4h12v12H4z" />
                <path d="M7 8h6M7 12h4" />
              </svg>
              Reports
            </button>
            <button
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="10" cy="10" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
          </nav>

          <div className="sidebar-footer">
            <span className="nodes-online-dot"></span>
            <span>Nodes Online</span>
            <span className="nodes-count">248 / 250</span>
          </div>
        </aside>

        {/* Main Workspace Page */}
        <main className="page-content">
          {apiSuccessMessage && (
            <div className="toast-success" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{apiSuccessMessage}</span>
              <button onClick={() => setApiSuccessMessage(null)} aria-label="Dismiss message">✕</button>
            </div>
          )}

          {/* Metric Overview Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">TOTAL MANAGED FLEET</span>
                <span className="metric-icon fleet-icon">🚛</span>
              </div>
              <div className="metric-body">
                <span className="metric-value">{records.length + 46}</span>
                <span className="metric-sub text-blue">96% hardware health</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">ACTIVE TELEMETRY FEED</span>
                <span className="metric-icon signal-icon">📡</span>
              </div>
              <div className="metric-body">
                <span className="metric-value">32</span>
                <span className="metric-sub text-green">Avg 58.4 km/h in transit</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">ASSIGNED RATIO</span>
                <span className="metric-icon link-icon">🔗</span>
              </div>
              <div className="metric-body">
                <span className="metric-value">{records.length + 44}/48</span>
                <span className="metric-sub text-muted">2 unlinked pending</span>
              </div>
            </div>

            <div className="metric-card danger-card">
              <div className="metric-header">
                <span className="metric-title">CRITICAL MAINTENANCE</span>
                <span className="metric-icon alert-icon">⚠️</span>
              </div>
              <div className="metric-body">
                <span className="metric-value text-danger">03</span>
                <span className="metric-sub text-danger">Service scheduled today</span>
              </div>
            </div>
          </div>

          {/* Main Registry Section & Action Bar */}
          <section className="registry-card">
            <div className="registry-header">
              <div className="registry-title-area">
                <h2>Fleet Management - Vehicles &amp; Device Setup</h2>
                <p>FRD Section 5: Unified dual-entity enrollment with guaranteed atomic association.</p>
              </div>

              <div className="registry-header-actions">
                <div className="search-box">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="M13 13l4.5 4.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by ID, plate, model, driver..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Filter fleet assets"
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={() => setSearchQuery("")} title="Clear search">
                      ✕
                    </button>
                  )}
                </div>

                {/* Task 2: Add the Add Device action */}
                <button
                  className="primary-button"
                  onClick={handleOpenModal}
                  id="add-device-vehicle-btn"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  + Add Device &amp; Vehicle
                </button>
              </div>
            </div>

            {records.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration">
                  <span className="ring-one"></span>
                  <span className="ring-two"></span>
                  <div className="illustration-tile">📦</div>
                </div>
                <h3>No registered devices yet</h3>
                <p>Click "Add Device &amp; Vehicle" above to enroll your first tracking device and vehicle pair.</p>
                <button className="secondary-button" onClick={handleOpenModal}>
                  + Add Device &amp; Vehicle
                </button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration">
                  <div className="illustration-tile">🔍</div>
                </div>
                <h3>No matching records found</h3>
                <p>No fleet assets matched "{searchQuery}". Try a different search term or clear the filter.</p>
                <button className="secondary-button" onClick={() => setSearchQuery("")}>
                  Clear Search Filter
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="registry-table">
                  <thead>
                    <tr>
                      <th>DEVICE ID</th>
                      <th>TYPE / MODEL</th>
                      <th>IMEI &amp; SIM</th>
                      <th>VEHICLE ID &amp; REG</th>
                      <th>LABEL &amp; TYPE</th>
                      <th>ASSIGNED DRIVER</th>
                      <th>STATUS</th>
                      <th>ENROLLED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <strong className="code-badge">{rec.deviceId}</strong>
                        </td>
                        <td>
                          <div>{rec.deviceType}</div>
                          <small className="text-muted">{rec.manufacturer} {rec.hardwareModel}</small>
                        </td>
                        <td>
                          <div className="mono-text">{rec.imeiSerial}</div>
                          <small className="text-muted">{rec.simMsisdn}</small>
                        </td>
                        <td>
                          <strong className="code-badge vehicle-badge">{rec.vehicleId}</strong>
                          <div className="mono-text">{rec.registrationNumber}</div>
                        </td>
                        <td>
                          <div>{rec.vehicleLabel}</div>
                          <small className="text-muted">{rec.vehicleType}</small>
                        </td>
                        <td>
                          <div>{rec.driverName}</div>
                          <small className="text-muted">{rec.driverContact}</small>
                        </td>
                        <td>
                          <span className={`status-pill ${rec.deviceStatus.toLowerCase()}`}>
                            {rec.deviceStatus}
                          </span>
                        </td>
                        <td>
                          <small className="text-muted">{rec.createdAt}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Controlled Creation Flow Modal (Tasks 1 - 34) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <header className="modal-header">
              <div className="modal-header-left">
                <span className="modal-icon" aria-hidden="true">🔗</span>
                <div>
                  <div className="modal-title-row">
                    <h2 id="modal-title">Add Device &amp; Vehicle</h2>
                    <span className="flow-badge">PHASE 1 CONTROLLED FLOW</span>
                  </div>
                  <p className="modal-subtitle">
                    FRD Section 5: Unified dual-entity enrollment with guaranteed atomic association.
                  </p>
                </div>
              </div>
              <button
                className="close-modal-button"
                onClick={handleCloseModal}
                aria-label="Close modal"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </header>

            {/* Error Banner for API Error Status Codes (Tasks 30-33) */}
            {apiErrorMessage && (
              <div className="error-banner" role="alert">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="error-text">
                  <strong>Enrollment Error</strong>
                  <p>{apiErrorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="modal-form">
              <div className="modal-body">
                {/* SECTION 1: DEVICE MASTER SPECIFICATION (Tasks 6-10) */}
                <fieldset className="form-section">
                  <legend className="section-legend">
                    <span className="section-number">1</span>
                    <span className="section-title">DEVICE MASTER SPECIFICATION</span>
                    <span className="gateway-badge">🛡️ Hardware Gateway Ready</span>
                  </legend>

                  <div className="form-grid">
                    {/* Device ID */}
                    <div className="field-group">
                      <div className="label-row">
                        <label htmlFor="deviceId">Device ID <span className="req">*</span></label>
                        {formData.deviceId.trim() && !errors.deviceId && (
                          <span className="validated-tag">✓ Unique Validated</span>
                        )}
                      </div>
                      <input
                        id="deviceId"
                        type="text"
                        placeholder="e.g. GPS-049"
                        value={formData.deviceId}
                        onChange={(e) => handleDeviceIdChange(e.target.value)}
                        className={errors.deviceId ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.deviceId && <span className="field-error-msg">{errors.deviceId}</span>}
                    </div>

                    {/* Device Type */}
                    <div className="field-group">
                      <label htmlFor="deviceType">Device Type <span className="req">*</span></label>
                      <select
                        id="deviceType"
                        value={formData.deviceType}
                        onChange={(e) => handleInputChange("deviceType", e.target.value)}
                        className={errors.deviceType ? "input-error" : ""}
                        disabled={isSubmitting}
                      >
                        <option value="Hardwired GPS">Hardwired GPS</option>
                        <option value="OBD Tracker">OBD Tracker</option>
                        <option value="Portable Telematics">Portable Telematics</option>
                        <option value="Satellite Telematics">Satellite Telematics</option>
                      </select>
                      {errors.deviceType && <span className="field-error-msg">{errors.deviceType}</span>}
                    </div>

                    {/* Device Status (Task 7) */}
                    <div className="field-group">
                      <label htmlFor="deviceStatus">Device Status <span className="req">*</span></label>
                      <select
                        id="deviceStatus"
                        value={formData.deviceStatus}
                        onChange={(e) => handleInputChange("deviceStatus", e.target.value)}
                        className={errors.deviceStatus ? "input-error" : ""}
                        disabled={isSubmitting}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      {errors.deviceStatus && <span className="field-error-msg">{errors.deviceStatus}</span>}
                    </div>

                    {/* IMEI / Serial */}
                    <div className="field-group">
                      <label htmlFor="imeiSerial">IMEI / Serial (15 digits) <span className="req">*</span></label>
                      <input
                        id="imeiSerial"
                        type="text"
                        placeholder="e.g. 864201048892110"
                        value={formData.imeiSerial}
                        onChange={(e) => handleInputChange("imeiSerial", e.target.value)}
                        className={errors.imeiSerial ? "input-error" : ""}
                        maxLength={18}
                        disabled={isSubmitting}
                      />
                      {errors.imeiSerial && <span className="field-error-msg">{errors.imeiSerial}</span>}
                    </div>

                    {/* SIM MSISDN */}
                    <div className="field-group">
                      <label htmlFor="simMsisdn">SIM MSISDN (+91 format) <span className="req">*</span></label>
                      <input
                        id="simMsisdn"
                        type="text"
                        placeholder="e.g. +91 98840 55123"
                        value={formData.simMsisdn}
                        onChange={(e) => handleInputChange("simMsisdn", e.target.value)}
                        className={errors.simMsisdn ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.simMsisdn && <span className="field-error-msg">{errors.simMsisdn}</span>}
                    </div>

                    {/* Hardware Model */}
                    <div className="field-group">
                      <label htmlFor="hardwareModel">Hardware Model <span className="req">*</span></label>
                      <input
                        id="hardwareModel"
                        type="text"
                        placeholder="e.g. FMB920"
                        value={formData.hardwareModel}
                        onChange={(e) => handleInputChange("hardwareModel", e.target.value)}
                        className={errors.hardwareModel ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.hardwareModel && <span className="field-error-msg">{errors.hardwareModel}</span>}
                    </div>

                    {/* Manufacturer */}
                    <div className="field-group col-span-3">
                      <label htmlFor="manufacturer">Manufacturer <span className="req">*</span></label>
                      <input
                        id="manufacturer"
                        type="text"
                        placeholder="e.g. Teltonika Telematics"
                        value={formData.manufacturer}
                        onChange={(e) => handleInputChange("manufacturer", e.target.value)}
                        className={errors.manufacturer ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.manufacturer && <span className="field-error-msg">{errors.manufacturer}</span>}
                    </div>
                  </div>
                </fieldset>

                {/* SECTION 2: ASSOCIATED VEHICLE PROFILE (Tasks 11-15) */}
                <fieldset className="form-section">
                  <legend className="section-legend">
                    <span className="section-number">2</span>
                    <span className="section-title">ASSOCIATED VEHICLE PROFILE</span>
                    <span className="linkage-badge">Automatic Linkage on Save</span>
                  </legend>

                  <div className="form-grid">
                    {/* Vehicle ID */}
                    <div className="field-group">
                      <div className="label-row">
                        <label htmlFor="vehicleId">Vehicle ID <span className="req">*</span></label>
                        {formData.vehicleId && (
                          <span className="gen-tag">Generated {formData.vehicleId}</span>
                        )}
                      </div>
                      <input
                        id="vehicleId"
                        type="text"
                        placeholder="e.g. VH-049"
                        value={formData.vehicleId}
                        onChange={(e) => handleInputChange("vehicleId", e.target.value)}
                        className={errors.vehicleId ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.vehicleId && <span className="field-error-msg">{errors.vehicleId}</span>}
                    </div>

                    {/* Registration Number */}
                    <div className="field-group">
                      <label htmlFor="registrationNumber">Registration Number <span className="req">*</span></label>
                      <input
                        id="registrationNumber"
                        type="text"
                        placeholder="e.g. TN 09 BK 4321"
                        value={formData.registrationNumber}
                        onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                        className={errors.registrationNumber ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.registrationNumber && <span className="field-error-msg">{errors.registrationNumber}</span>}
                    </div>

                    {/* Vehicle Type */}
                    <div className="field-group">
                      <label htmlFor="vehicleType">Vehicle Type <span className="req">*</span></label>
                      <select
                        id="vehicleType"
                        value={formData.vehicleType}
                        onChange={(e) => handleInputChange("vehicleType", e.target.value)}
                        className={errors.vehicleType ? "input-error" : ""}
                        disabled={isSubmitting}
                      >
                        <option value="Heavy Truck">Heavy Truck</option>
                        <option value="Container Carrier">Container Carrier</option>
                        <option value="Express Van">Express Van</option>
                        <option value="Light Commercial">Light Commercial</option>
                        <option value="Pickup Utility">Pickup Utility</option>
                      </select>
                      {errors.vehicleType && <span className="field-error-msg">{errors.vehicleType}</span>}
                    </div>

                    {/* Vehicle Display Label */}
                    <div className="field-group">
                      <label htmlFor="vehicleLabel">Vehicle Display Label</label>
                      <input
                        id="vehicleLabel"
                        type="text"
                        placeholder="e.g. Express Freight 14"
                        value={formData.vehicleLabel}
                        onChange={(e) => handleInputChange("vehicleLabel", e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* Driver Name */}
                    <div className="field-group">
                      <label htmlFor="driverName">Assigned Driver Name</label>
                      <input
                        id="driverName"
                        type="text"
                        placeholder="e.g. Karthik Selvam"
                        value={formData.driverName}
                        onChange={(e) => handleInputChange("driverName", e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* Driver Contact */}
                    <div className="field-group">
                      <label htmlFor="driverContact">Driver Mobile Contact</label>
                      <input
                        id="driverContact"
                        type="text"
                        placeholder="e.g. +91 96001 92834"
                        value={formData.driverContact}
                        onChange={(e) => handleInputChange("driverContact", e.target.value)}
                        className={errors.driverContact ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.driverContact && <span className="field-error-msg">{errors.driverContact}</span>}
                    </div>
                  </div>
                </fieldset>

                {/* Constraint Verification Banner */}
                <div className="constraint-banner">
                  <div className="shield-icon" aria-hidden="true">🛡️</div>
                  <div>
                    <strong>All unique constraints verified.</strong>
                    <p>
                      Associated relationship ({formData.deviceId || "GPS-XXX"} ↔ {formData.vehicleId || "VH-XXX"}) will be established atomically upon commit. No orphan state permitted.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <footer className="modal-footer">
                <div className="schema-info">
                  <span>Schema v1.02</span>
                  <span className="bullet">•</span>
                  <span className={isPayloadValid ? "payload-valid-badge" : "payload-draft-badge"}>
                    {isPayloadValid ? "Payload Valid" : "Drafting Pair"}
                  </span>
                </div>
                <div className="footer-buttons">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>

                  {/* Task 20: Prevent duplicate submission and allow valid data to save */}
                  <button
                    type="submit"
                    className="save-button"
                    disabled={isSubmitting}
                    id="save-asset-pair-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="button-spinner"></span>
                        Saving Asset Pair...
                      </>
                    ) : (
                      <>
                        💾 Save Device &amp; Vehicle
                      </>
                    )}
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
