/// <reference types="vite/client" />
import { useState, useEffect, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import "../App.css";

type DeviceVehicleRecord = {
  id: string;
  deviceRecordId: string;
  vehicleRecordId: string;
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
  vehicleYear: string;
  vehicleLabel: string;
  driverName: string;
  driverContact: string;
  createdAt: string;
  updatedAt: string;
};

type ApiEntity = Record<string, unknown>;

const asEntityArray = (value: unknown): ApiEntity[] => {
  if (Array.isArray(value)) return value as ApiEntity[];
  if (value && typeof value === "object" && "data" in value) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return data as ApiEntity[];
  }
  return [];
};

const asEntityObject = (value: unknown): ApiEntity => {
  if (!value || typeof value !== "object") return {};
  const entity = value as ApiEntity;
  return entity.data && typeof entity.data === "object" && !Array.isArray(entity.data)
    ? entity.data as ApiEntity
    : entity;
};

const textValue = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

const displayValue = (value: string | undefined): string => value?.trim() || "—";

const formatDate = (value: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : `${new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date)} IST`;
};

const errorForStatus = (status: number, operation: "create" | "update"): string => {
  const messages: Record<number, string> = {
    400: "Validation Error (400): Invalid payload format or unsupported fields.",
    401: operation === "create" ? "Unauthorized (401): Admin credentials required to add assets." : "Unauthorized (401): Admin credentials required to update assets.",
    403: operation === "create" ? "Forbidden (403): You do not have permissions for asset creation." : "Forbidden (403): You do not have permissions for asset updates.",
    404: operation === "create" ? "Not Found (404): Creation endpoint not found." : "Not Found (404): Record not found.",
    405: operation === "create" ? "Method Not Allowed (405): POST action rejected." : "Method Not Allowed (405): Update action rejected.",
    409: "Conflict (409): Device ID or Registration Number already exists.",
    500: operation === "create" ? "Server Error (500): Could not create asset setup." : "Server Error (500): Could not update asset setup.",
  };
  return messages[status] ?? `Request failed (${status}).`;
};

const highlightMatch = (value: string, query: string): ReactNode => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return displayValue(value);
  const start = value.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (start < 0) return displayValue(value);
  return <>{value.slice(0, start)}<mark>{value.slice(start, start + normalizedQuery.length)}</mark>{value.slice(start + normalizedQuery.length)}</>;
};

const mapRecords = (devices: ApiEntity[], vehicles: ApiEntity[], linkSinglePair = false): DeviceVehicleRecord[] => {
  const vehicleById = new Map(vehicles.map((vehicle) => [textValue(vehicle.id), vehicle]));
  return devices.map((device) => {
    const linkedVehicle = vehicleById.get(textValue(device.vehicleId)) ??
      (linkSinglePair && devices.length === 1 && vehicles.length === 1 ? vehicles[0] : {});
    return {
      id: textValue(device.id) || textValue(device.identifier),
      deviceRecordId: textValue(device.id),
      vehicleRecordId: textValue(linkedVehicle.id),
      deviceId: textValue(device.identifier),
      deviceType: textValue(device.type ?? device.deviceType),
      imeiSerial: textValue(device.imei ?? device.serialNumber ?? device.identifier),
      simMsisdn: textValue(device.simMsisdn),
      manufacturer: textValue(device.manufacturer),
      hardwareModel: textValue(device.hardwareModel),
      deviceStatus: textValue(device.status) || "unknown",
      vehicleId: textValue(linkedVehicle.vehicleId),
      registrationNumber: textValue(linkedVehicle.plateNumber),
      vehicleType: textValue(linkedVehicle.vehicleType),
      vehicleYear: textValue(linkedVehicle.year),
      vehicleLabel: textValue(linkedVehicle.model),
      driverName: textValue(linkedVehicle.driverName),
      driverContact: textValue(linkedVehicle.driverContact),
      createdAt: textValue(linkedVehicle.createdAt),
      updatedAt: textValue(linkedVehicle.updatedAt),
    };
  });
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
  vehicleYear: string;
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
  vehicleYear: String(new Date().getFullYear()),
  vehicleLabel: "",
  driverName: "",
  driverContact: "",
};

function App() {
  const [activeTab, setActiveTab] = useState<"fleet" | "dashboard" | "live" | "history" | "reports" | "settings">("fleet");
  const [records, setRecords] = useState<DeviceVehicleRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [retryRecords, setRetryRecords] = useState(0);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreationForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [apiSuccessMessage, setApiSuccessMessage] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DeviceVehicleRecord | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [retryDetails, setRetryDetails] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const submissionInProgress = useRef(false);
  const vehicleIdManuallyEdited = useRef(false);
  const hasFetchedRecords = useRef(false);
  const lastRecordsRetry = useRef(retryRecords);

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

  useEffect(() => {
    if (lastRecordsRetry.current !== retryRecords) {
      hasFetchedRecords.current = false;
      lastRecordsRetry.current = retryRecords;
    }
    const controller = new AbortController();
    const token = localStorage.getItem("fleet_auth_token");
    if (!token) {
      setAuthRequired(true);
      setRecordsError(null);
      setIsLoadingRecords(false);
      return () => controller.abort();
    }

    setAuthRequired(false);
    setIsLoadingRecords(true);
    setRecordsError(null);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const requestTimer = window.setTimeout(() => {
      if (hasFetchedRecords.current) return;
      hasFetchedRecords.current = true;
      Promise.all([
        fetch("/api/v1/devices", { headers, signal: controller.signal }),
        fetch("/api/v1/vehicles", { headers, signal: controller.signal }),
      ])
        .then(async ([deviceResponse, vehicleResponse]) => {
          if (!deviceResponse.ok || !vehicleResponse.ok) {
            if (deviceResponse.status === 401 || vehicleResponse.status === 401) setAuthRequired(true);
            throw new Error("Could not load records. Check your connection and retry.");
          }
          const [devicePayload, vehiclePayload] = await Promise.all([
            deviceResponse.json(),
            vehicleResponse.json(),
          ]);
          if (controller.signal.aborted) return;
          setRecords(mapRecords(asEntityArray(devicePayload), asEntityArray(vehiclePayload)));
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRecordsError(error instanceof TypeError ? "Could not load records. Check your connection and retry." : error instanceof Error ? error.message : "Could not load records. Check your connection and retry.");
          setRecords([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingRecords(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(requestTimer);
      controller.abort();
    };
  }, [retryRecords]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      const url = new URL(window.location.href);
      if (searchQuery.trim()) url.searchParams.set("search", searchQuery.trim());
      else url.searchParams.delete("search");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedRecord || isModalOpen) return;
    const controller = new AbortController();
    const token = localStorage.getItem("fleet_auth_token");
    if (!token) {
      setDetailError("Authentication required");
      return () => controller.abort();
    }

    setIsLoadingDetails(true);
    setDetailError(null);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    Promise.all([
      fetch(`/api/v1/devices/${encodeURIComponent(selectedRecord.deviceRecordId)}`, { headers, signal: controller.signal }),
      selectedRecord.vehicleRecordId
        ? fetch(`/api/v1/vehicles/${encodeURIComponent(selectedRecord.vehicleRecordId)}`, { headers, signal: controller.signal })
        : Promise.resolve(null),
    ])
      .then(async ([deviceResponse, vehicleResponse]) => {
        if (!deviceResponse.ok || (vehicleResponse && !vehicleResponse.ok)) {
          throw new Error("Could not load record details.");
        }
        const device = asEntityObject(await deviceResponse.json());
        const vehicle = vehicleResponse ? asEntityObject(await vehicleResponse.json()) : {};
        if (controller.signal.aborted) return;
        const [details] = mapRecords([device], vehicleResponse ? [vehicle] : [], true);
        setSelectedRecord((current) => current ? {
          ...current,
          ...details,
          deviceType: details.deviceType || current.deviceType,
          imeiSerial: details.imeiSerial || current.imeiSerial,
          simMsisdn: details.simMsisdn || current.simMsisdn,
          manufacturer: details.manufacturer || current.manufacturer,
          hardwareModel: details.hardwareModel || current.hardwareModel,
          vehicleId: details.vehicleId || current.vehicleId,
          registrationNumber: details.registrationNumber || current.registrationNumber,
          vehicleType: details.vehicleType || current.vehicleType,
          vehicleLabel: details.vehicleLabel || current.vehicleLabel,
          driverName: details.driverName || current.driverName,
          driverContact: details.driverContact || current.driverContact,
        } : current);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetailError(error instanceof TypeError ? "Could not load record details." : error instanceof Error ? error.message : "Could not load record details.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingDetails(false);
      });
    return () => controller.abort();
  }, [selectedRecord?.deviceRecordId, selectedRecord?.vehicleRecordId, isModalOpen, retryDetails]);

  // Filter records based on search query
  const filteredRecords = records.filter((rec) => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      rec.deviceId.toLowerCase().includes(q) ||
      rec.registrationNumber.toLowerCase().includes(q) ||
      rec.vehicleId.toLowerCase().includes(q)
    );
  });

  // Auto-generate Vehicle ID when Device ID changes if Vehicle ID hasn't been manually edited
  const handleDeviceIdChange = (value: string) => {
    const trimmed = value.trim();
    let autoVehicleId = "";
    
    if (trimmed.toUpperCase().startsWith("GPS-")) {
      autoVehicleId = "VH-" + trimmed.slice(4);
    } else if (trimmed) {
      autoVehicleId = "VH-" + trimmed;
    }

    setFormData((prev) => ({
      ...prev,
      deviceId: value,
      vehicleId: vehicleIdManuallyEdited.current ? prev.vehicleId : autoVehicleId,
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
    /^\+91\s?[6-9]\d{4}\s?\d{5}$/.test(formData.simMsisdn.trim()) &&
    Boolean(formData.manufacturer.trim()) &&
    Boolean(formData.hardwareModel.trim()) &&
    Boolean(formData.deviceStatus) &&
    Boolean(formData.vehicleId.trim()) &&
    Boolean(formData.registrationNumber.trim()) &&
    Boolean(formData.vehicleType) &&
    Number.isInteger(Number(formData.vehicleYear)) && Number(formData.vehicleYear) >= 1900 && Number(formData.vehicleYear) <= 2100 &&
    (!formData.driverContact.trim() || /^\+91\s?[6-9]\d{4}\s?\d{5}$/.test(formData.driverContact.trim()));

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
    } else if (!/^\+91\s?[6-9]\d{4}\s?\d{5}$/.test(formData.simMsisdn.trim())) {
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
    if (!Number.isInteger(Number(formData.vehicleYear)) || Number(formData.vehicleYear) < 1900 || Number(formData.vehicleYear) > 2100) {
      newErrors.vehicleYear = "Vehicle year must be between 1900 and 2100";
    }
    if (formData.driverContact.trim() && !/^\+91\s?[6-9]\d{4}\s?\d{5}$/.test(formData.driverContact.trim())) {
      newErrors.driverContact = "Invalid driver contact format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenModal = (record?: DeviceVehicleRecord) => {
    setIsEditMode(Boolean(record));
    setSelectedRecord(record ?? null);
    vehicleIdManuallyEdited.current = false;
    setFormData(record ? {
      deviceId: record.deviceId,
      deviceType: record.deviceType || initialForm.deviceType,
      imeiSerial: record.imeiSerial,
      simMsisdn: record.simMsisdn,
      manufacturer: record.manufacturer,
      hardwareModel: record.hardwareModel,
      deviceStatus: record.deviceStatus.toLowerCase() === "inactive" ? "Inactive" : "Active",
      vehicleId: record.vehicleId,
      registrationNumber: record.registrationNumber,
      vehicleType: record.vehicleType || initialForm.vehicleType,
      vehicleYear: record.vehicleYear || initialForm.vehicleYear,
      vehicleLabel: record.vehicleLabel,
      driverName: record.driverName,
      driverContact: record.driverContact,
    } : initialForm);
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
    setIsEditMode(false);
    setSelectedRecord(null);
    vehicleIdManuallyEdited.current = false;
    setFormData(initialForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submissionInProgress.current) return;
    setApiErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    const token = localStorage.getItem("fleet_auth_token");
    if (!token) {
      setApiErrorMessage("Authentication required");
      setIsSubmitting(false);
      submissionInProgress.current = false;
      return;
    }
    const deviceStatus = formData.deviceStatus.toLowerCase();
    const vehiclePayload = {
      plateNumber: formData.registrationNumber.trim().toUpperCase(),
      make: formData.manufacturer.trim(),
      model: formData.vehicleLabel.trim() || formData.hardwareModel.trim(),
      year: Number(formData.vehicleYear),
      status: deviceStatus,
    };
    const devicePayload = { identifier: formData.deviceId.trim(), status: deviceStatus };
    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (isEditMode && selectedRecord) {
        const [deviceResponse, vehicleResponse] = await Promise.all([
          fetch(`/api/v1/devices/${encodeURIComponent(selectedRecord.deviceRecordId)}`, {
            method: "PUT", headers, body: JSON.stringify(devicePayload),
          }),
          fetch(`/api/v1/vehicles/${encodeURIComponent(selectedRecord.vehicleRecordId)}`, {
            method: "PUT", headers, body: JSON.stringify(vehiclePayload),
          }),
        ]);
        if (!deviceResponse.ok || !vehicleResponse.ok) {
          const failedResponse = !deviceResponse.ok ? deviceResponse : vehicleResponse;
          throw new Error(errorForStatus(failedResponse.status, "update"));
        }
        const updated: DeviceVehicleRecord = {
          ...selectedRecord,
          deviceId: formData.deviceId.trim(),
          deviceStatus,
          registrationNumber: vehiclePayload.plateNumber,
          manufacturer: vehiclePayload.make,
          vehicleLabel: vehiclePayload.model,
          vehicleYear: String(vehiclePayload.year),
          updatedAt: new Date().toISOString(),
        };
        setRecords((previous) => previous.map((record) => record.deviceRecordId === selectedRecord.deviceRecordId ? updated : record));
        setSelectedRecord(updated);
        setToastMessage("Device & Vehicle updated successfully");
      } else {
        const response = await fetch("/api/v1/setup/vehicle-device", {
          method: "POST",
          headers,
          body: JSON.stringify({ vehicle: vehiclePayload, device: devicePayload }),
        });
        if (!response.ok) throw new Error(errorForStatus(response.status, "create"));
        const payload = await response.json();
        const data = payload?.data ?? payload;
        const createdDevice = data?.device ?? {};
        const createdVehicle = data?.vehicle ?? {};
        const newRecord = mapRecords([createdDevice], [createdVehicle], true)[0];
        if (newRecord.deviceRecordId && newRecord.vehicleRecordId) {
          setRecords((previous) => [newRecord, ...previous]);
        } else {
          setRetryRecords((previous) => previous + 1);
        }
        setToastMessage("Device & Vehicle created successfully");
      }
      setIsModalOpen(false);
      setIsEditMode(false);
      setFormData(initialForm);
    } catch (error: unknown) {
      setApiErrorMessage(error instanceof TypeError
        ? isEditMode
          ? "Update API unavailable — changes could not be saved"
          : "Connection Error: Could not reach the server. Please try again."
        : error instanceof Error
          ? error.message
          : "Request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
      submissionInProgress.current = false;
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
          <span className="phase-badge">PHASE 2</span>
          <span className="console-path">Console &gt; <strong>Fleet Telematics</strong></span>
        </div>

        <div className="topbar-right">
              <div className={`status-indicator ${authRequired || recordsError ? "connection-error" : isLoadingRecords ? "connection-pending" : ""}`}>
            <span className="pulse-dot"></span>
            <span>{authRequired ? "Authentication required" : recordsError ? "API unavailable" : isLoadingRecords ? "Connecting to API" : "Fleet API connected"}</span>
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
            <span className="avatar">FA</span>
            <div className="user-info">
              <span className="user-name">Fleet Admin</span>
              <span className="user-role">Administrator</span>
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
              Fleet Registry
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
            <span>Registry records</span>
            <span className="nodes-count">{isLoadingRecords ? "—" : records.length}</span>
          </div>
        </aside>

        {/* Main Workspace Page */}
        <main className="page-content">
          {(toastMessage || apiSuccessMessage) && (
            <div className="toast-success" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{toastMessage || apiSuccessMessage}</span>
              <button onClick={() => { setToastMessage(null); setApiSuccessMessage(null); }} aria-label="Dismiss message">✕</button>
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
                <span className="metric-value">{isLoadingRecords ? "—" : records.length}</span>
                <span className="metric-sub text-blue">Registered device pairs</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">ACTIVE DEVICES</span>
                <span className="metric-icon signal-icon">📡</span>
              </div>
              <div className="metric-body">
                <span className="metric-value">{isLoadingRecords ? "—" : records.filter((record) => record.deviceStatus.toLowerCase() === "active").length}</span>
                <span className="metric-sub text-green">Active registered devices</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">ASSIGNED RATIO</span>
                <span className="metric-icon link-icon">🔗</span>
              </div>
              <div className="metric-body">
                <span className="metric-value">{isLoadingRecords ? "—" : records.filter((record) => Boolean(record.vehicleRecordId)).length}/{isLoadingRecords ? "—" : records.length}</span>
                <span className="metric-sub text-muted">Linked vehicle records</span>
              </div>
            </div>

            <div className="metric-card danger-card">
              <div className="metric-header">
                <span className="metric-title">CRITICAL MAINTENANCE</span>
                <span className="metric-icon alert-icon">⚠️</span>
              </div>
              <div className="metric-body">
                <span className="metric-value text-danger">{isLoadingRecords ? "—" : records.filter((record) => record.deviceStatus.toLowerCase() === "maintenance").length}</span>
                <span className="metric-sub text-danger">Devices in maintenance</span>
              </div>
            </div>
          </div>

          {/* Main Registry Section & Action Bar */}
          <section className="registry-card">
            <div className="registry-header">
              <div className="registry-title-area">
                <p className="breadcrumb">Console &gt; Fleet &gt; Registry</p>
                <h2>Fleet Registry</h2>
                <p>Devices and their associated vehicles</p>
              </div>

              <div className="registry-header-actions">
                <div className="search-box">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="M13 13l4.5 4.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by Device ID, Vehicle ID, or Registration..."
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
                  onClick={() => handleOpenModal()}
                  id="add-device-vehicle-btn"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  + Add Device &amp; Vehicle
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="registry-table">
                <thead>
                  <tr>
                    <th>DEVICE ID</th>
                    <th>DEVICE TYPE</th>
                    <th>VEHICLE ID</th>
                    <th>REGISTRATION NUMBER</th>
                    <th>STATUS</th>
                    <th>LAST UPDATED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRecords ? Array.from({ length: 3 }, (_, rowIndex) => (
                    <tr key={`loading-${rowIndex}`} className="skeleton-row">
                      {Array.from({ length: 7 }, (_, cellIndex) => <td key={cellIndex}><span /></td>)}
                    </tr>
                  )) : authRequired ? (
                    <tr><td className="table-message" colSpan={7}>Authentication required. Sign in as an administrator to view fleet records.</td></tr>
                  ) : recordsError ? (
                    <tr><td className="table-message" colSpan={7}>{recordsError} <button className="text-button" onClick={() => setRetryRecords((value) => value + 1)}>Retry</button></td></tr>
                  ) : records.length === 0 ? (
                    <tr><td className="table-message" colSpan={7}><strong>No devices registered yet</strong><br /><button className="secondary-button" onClick={() => handleOpenModal()}>Add Device &amp; Vehicle</button></td></tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr><td className="table-message" colSpan={7}>No records match “{debouncedSearch}”. <button className="text-button" onClick={() => setSearchQuery("")}>Clear search</button></td></tr>
                  ) : filteredRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong className="code-badge">{highlightMatch(rec.deviceId, debouncedSearch)}</strong></td>
                      <td>{displayValue(rec.deviceType)}</td>
                      <td><strong className="code-badge vehicle-badge">{highlightMatch(rec.vehicleId, debouncedSearch)}</strong></td>
                      <td className="mono-text">{highlightMatch(rec.registrationNumber, debouncedSearch)}</td>
                      <td><span className={`status-pill ${rec.deviceStatus.toLowerCase()}`}>{displayValue(rec.deviceStatus)}</span></td>
                      <td><small className="text-muted">{formatDate(rec.updatedAt || rec.createdAt)}</small></td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-button" title="View record" aria-label="View record" onClick={() => { setDetailError(null); setSelectedRecord(rec); }}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2"/></svg>
                          </button>
                          <button className="icon-button" title="Edit record" aria-label="Edit record" onClick={() => handleOpenModal(rec)}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m12.8 4.2 3 3M3 17l3.7-.8L16.4 6.5a2.1 2.1 0 0 0-3-3L3.8 13.2 3 17Z"/></svg>
                          </button>
                          <button className="icon-button" title="Track live location" aria-label="Track live location" onClick={() => setToastMessage("Live tracking coming in Phase 2")}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M16 8c0 4-6 9-6 9S4 12 4 8a6 6 0 1 1 12 0Z"/><circle cx="10" cy="8" r="2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="registry-count">Showing {filteredRecords.length} of {records.length} records</div>
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
                      <h2 id="modal-title">{isEditMode ? "Edit Device &amp; Vehicle" : "Add Device &amp; Vehicle"}</h2>
                    <span className="flow-badge">PHASE 2</span>
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
                          <span className="validated-tag">ID entered</span>
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
                        onChange={(e) => {
                          vehicleIdManuallyEdited.current = true;
                          handleInputChange("vehicleId", e.target.value);
                        }}
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

                    <div className="field-group">
                      <label htmlFor="vehicleYear">Vehicle Year <span className="req">*</span></label>
                      <input
                        id="vehicleYear"
                        type="number"
                        min="1900"
                        max="2100"
                        value={formData.vehicleYear}
                        onChange={(e) => handleInputChange("vehicleYear", e.target.value)}
                        className={errors.vehicleYear ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.vehicleYear && <span className="field-error-msg">{errors.vehicleYear}</span>}
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
                    <strong>Identifiers are checked by the server.</strong>
                    <p>
                      The API creates the device and vehicle together. Duplicate identifiers are reported here without changing the registry.
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
                    ) : isEditMode ? (
                      <>Save Changes</>
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

      {selectedRecord && !isModalOpen && (
        <div className="drawer-backdrop" onClick={() => setSelectedRecord(null)}>
          <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(event) => event.stopPropagation()}>
            <header className="drawer-header">
              <div>
                <p className="breadcrumb">Fleet Registry / Record</p>
                <h2 id="detail-title">{displayValue(selectedRecord.deviceId)}</h2>
              </div>
              <div className="drawer-actions">
                <button className="secondary-button" onClick={() => handleOpenModal(selectedRecord)}>Edit</button>
                <button className="icon-button" title="Close details" aria-label="Close details" onClick={() => setSelectedRecord(null)}>×</button>
              </div>
            </header>
            <div className="drawer-content">
              {isLoadingDetails ? (
                <div className="detail-skeleton" aria-label="Loading record details">
                  {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
                </div>
              ) : detailError ? (
                <div className="detail-load-error" role="alert">
                  <p>{detailError}</p>
                  <button className="text-button" onClick={() => setRetryDetails((value) => value + 1)}>Retry</button>
                </div>
              ) : <>
              <section className="detail-section">
                <h3>Device Master</h3>
                <dl>
                  <div><dt>Device ID</dt><dd>{displayValue(selectedRecord.deviceId)}</dd></div>
                  <div><dt>Device Type</dt><dd>{displayValue(selectedRecord.deviceType)}</dd></div>
                  <div><dt>IMEI / Serial Number</dt><dd>{displayValue(selectedRecord.imeiSerial)}</dd></div>
                  <div><dt>SIM MSISDN</dt><dd>{displayValue(selectedRecord.simMsisdn)}</dd></div>
                  <div><dt>Manufacturer</dt><dd>{displayValue(selectedRecord.manufacturer)}</dd></div>
                  <div><dt>Hardware Model</dt><dd>{displayValue(selectedRecord.hardwareModel)}</dd></div>
                  <div><dt>Device Status</dt><dd><span className={`status-pill ${selectedRecord.deviceStatus.toLowerCase()}`}>{displayValue(selectedRecord.deviceStatus)}</span></dd></div>
                </dl>
              </section>
              <section className="detail-section">
                <h3>Vehicle Profile</h3>
                <dl>
                  <div><dt>Vehicle ID</dt><dd>{displayValue(selectedRecord.vehicleId)}</dd></div>
                  <div><dt>Registration Number</dt><dd>{displayValue(selectedRecord.registrationNumber)}</dd></div>
                  <div><dt>Vehicle Type</dt><dd>{displayValue(selectedRecord.vehicleType)}</dd></div>
                  <div><dt>Vehicle Display Label</dt><dd>{displayValue(selectedRecord.vehicleLabel)}</dd></div>
                  <div><dt>Assigned Driver Name</dt><dd>{displayValue(selectedRecord.driverName)}</dd></div>
                  <div><dt>Driver Mobile Contact</dt><dd>{displayValue(selectedRecord.driverContact)}</dd></div>
                </dl>
              </section>
              <section className="detail-section">
                <h3>Metadata</h3>
                <dl>
                  <div><dt>Created At</dt><dd>{formatDate(selectedRecord.createdAt)}</dd></div>
                  <div><dt>Last Updated</dt><dd>{formatDate(selectedRecord.updatedAt || selectedRecord.createdAt)}</dd></div>
                </dl>
              </section>
              </>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
