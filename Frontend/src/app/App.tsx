/// <reference types="vite/client" />
import { useState, useEffect, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import "../App.css";

type DeviceVehicleRecord = {
  id: string;
  deviceRecordId: string;
  vehicleRecordId: string;
  deviceId: string;
  deviceStatus: string;
  vehicleId: string;
  registrationNumber: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleStatus: string;
  createdAt: string;
  updatedAt: string;
};

type ApiEntity = Record<string, unknown>;

const asEntityArray = (value: unknown): ApiEntity[] => {
  const data =
    Array.isArray(value)
      ? value
      : value && typeof value === "object" && "data" in value
        ? (value as { data?: unknown }).data
        : undefined;
  if (
    !Array.isArray(data) ||
    !data.every(
      (item) => typeof item === "object" && item !== null && !Array.isArray(item),
    )
  ) {
    throw new Error("The API returned an invalid records response.");
  }
  return data as ApiEntity[];
};

const asEntityObject = (value: unknown): ApiEntity => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The API returned an invalid record response.");
  }
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

const errorForStatus = async (
  response: Response,
  operation: "create" | "update" | "load",
): Promise<string> => {
  let message: string | undefined;
  try {
    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      message = payload.message;
    }
  } catch {
    // Fall back to a status-specific message when the server returned no JSON.
  }
  if (
    message &&
    message !== "Internal server error" &&
    !(response.status === 401 && message === "Unauthorized") &&
    !(response.status === 403 && message === "Forbidden")
  ) {
    return message;
  }

  const messages: Record<number, string> = {
    400: "The server rejected the submitted fields. Check the values and try again.",
    401: "Authentication required. Sign in as an administrator and try again.",
    403: operation === "create" ? "You do not have permission to create records." : "You do not have permission to access these records.",
    404: operation === "create" ? "The asset setup endpoint was not found." : operation === "load" ? "The requested record was not found." : "The record was not found.",
    409: "A device identifier or vehicle registration number is already in use.",
    500: operation === "create" ? "The server could not create the device and vehicle." : operation === "load" ? "The server could not load fleet records." : "The server could not update the records.",
  };
  return messages[response.status] ?? `Request failed (${response.status}).`;
};

const highlightMatch = (value: string, query: string): ReactNode => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return displayValue(value);
  const start = value.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (start < 0) return displayValue(value);
  return <>{value.slice(0, start)}<mark>{value.slice(start, start + normalizedQuery.length)}</mark>{value.slice(start + normalizedQuery.length)}</>;
};

const mapRecords = (devices: ApiEntity[], vehicles: ApiEntity[]): DeviceVehicleRecord[] => {
  const vehicleById = new Map(vehicles.map((vehicle) => [textValue(vehicle.id), vehicle]));
  return devices.map((device) => {
    const linkedVehicle = vehicleById.get(textValue(device.vehicleId)) ?? {};
    return {
      id: textValue(device.id),
      deviceRecordId: textValue(device.id),
      vehicleRecordId: textValue(linkedVehicle.id),
      deviceId: textValue(device.identifier),
      deviceStatus: textValue(device.status),
      vehicleId: textValue(device.vehicleId),
      registrationNumber: textValue(linkedVehicle.plateNumber),
      vehicleYear: textValue(linkedVehicle.year),
      vehicleMake: textValue(linkedVehicle.make),
      vehicleModel: textValue(linkedVehicle.model),
      vehicleStatus: textValue(linkedVehicle.status),
      createdAt: textValue(device.createdAt),
      updatedAt: textValue(linkedVehicle.updatedAt) || textValue(device.updatedAt),
    };
  });
};

type CreationForm = {
  deviceId: string;
  deviceStatus: string;
  registrationNumber: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleStatus: string;
};

type FormErrors = Partial<Record<keyof CreationForm, string>>;

const initialForm: CreationForm = {
  deviceId: "",
  deviceStatus: "active",
  registrationNumber: "",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleStatus: "active",
};

const pageSize = 100;

async function fetchAllPages(
  path: "/api/v1/devices" | "/api/v1/vehicles",
  headers: HeadersInit,
  signal: AbortSignal,
): Promise<ApiEntity[]> {
  const firstResponse = await fetch(`${path}?page=1&limit=${pageSize}`, {
    headers,
    signal,
  });
  if (!firstResponse.ok) {
    throw new Error(await errorForStatus(firstResponse, "load"));
  }
  const firstPayload: unknown = await firstResponse.json();
  const firstPage = asEntityArray(firstPayload);
  if (
    !firstPayload ||
    typeof firstPayload !== "object" ||
    !("meta" in firstPayload) ||
    !firstPayload.meta ||
    typeof firstPayload.meta !== "object" ||
    !("total" in firstPayload.meta) ||
    typeof firstPayload.meta.total !== "number" ||
    !Number.isInteger(firstPayload.meta.total) ||
    firstPayload.meta.total < 0
  ) {
    throw new Error("The API returned invalid pagination metadata.");
  }

  const total = firstPayload.meta.total;
  const pages = Math.ceil(total / pageSize);
  const allRecords = [...firstPage];
  for (let page = 2; page <= pages; page += 1) {
    const response = await fetch(`${path}?page=${page}&limit=${pageSize}`, {
      headers,
      signal,
    });
    if (!response.ok) {
      throw new Error(await errorForStatus(response, "load"));
    }
    allRecords.push(...asEntityArray(await response.json()));
  }
  return allRecords;
}

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
    Promise.all([
      fetchAllPages("/api/v1/devices", headers, controller.signal),
      fetchAllPages("/api/v1/vehicles", headers, controller.signal),
    ])
      .then(([devices, vehicles]) => {
        if (controller.signal.aborted) return;
        setRecords(mapRecords(devices, vehicles));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.message.startsWith("Authentication required")) {
          setAuthRequired(true);
        }
        setRecordsError(error instanceof TypeError
          ? "Could not load records. Check your connection and retry."
          : error instanceof Error
            ? error.message
            : "Could not load records. Check your connection and retry.");
        setRecords([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingRecords(false);
      });

    return () => controller.abort();
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
      setIsLoadingDetails(false);
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
        if (!deviceResponse.ok) {
          throw new Error(await errorForStatus(deviceResponse, "load"));
        }
        if (vehicleResponse && !vehicleResponse.ok) {
          throw new Error(await errorForStatus(vehicleResponse, "load"));
        }
        const device = asEntityObject(await deviceResponse.json());
        const vehicle = vehicleResponse ? asEntityObject(await vehicleResponse.json()) : {};
        if (controller.signal.aborted) return;
        const [details] = mapRecords([device], vehicleResponse ? [vehicle] : []);
        setSelectedRecord((current) =>
          current?.deviceRecordId === selectedRecord.deviceRecordId
            ? details
            : current,
        );
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
      rec.vehicleId.toLowerCase().includes(q) ||
      rec.vehicleMake.toLowerCase().includes(q) ||
      rec.vehicleModel.toLowerCase().includes(q)
    );
  });

  const handleInputChange = (field: keyof CreationForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiErrorMessage(null);
  };

  const isPayloadValid =
    formData.deviceId.trim().length >= 1 &&
    formData.deviceId.trim().length <= 100 &&
    formData.registrationNumber.trim().length >= 1 &&
    formData.registrationNumber.trim().length <= 20 &&
    formData.vehicleMake.trim().length >= 1 &&
    formData.vehicleMake.trim().length <= 100 &&
    formData.vehicleModel.trim().length >= 1 &&
    formData.vehicleModel.trim().length <= 100 &&
    Number.isInteger(Number(formData.vehicleYear)) &&
    Number(formData.vehicleYear) >= 1900 &&
    Number(formData.vehicleYear) <= 2100;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.deviceId.trim()) {
      newErrors.deviceId = "Device identifier is required.";
    } else if (formData.deviceId.trim().length > 100) {
      newErrors.deviceId = "Device identifier must be 100 characters or fewer.";
    }
    if (!formData.registrationNumber.trim()) {
      newErrors.registrationNumber = "Registration number is required.";
    } else if (formData.registrationNumber.trim().length > 20) {
      newErrors.registrationNumber = "Registration number must be 20 characters or fewer.";
    }
    if (!formData.vehicleMake.trim()) {
      newErrors.vehicleMake = "Vehicle make is required.";
    } else if (formData.vehicleMake.trim().length > 100) {
      newErrors.vehicleMake = "Vehicle make must be 100 characters or fewer.";
    }
    if (!formData.vehicleModel.trim()) {
      newErrors.vehicleModel = "Vehicle model is required.";
    } else if (formData.vehicleModel.trim().length > 100) {
      newErrors.vehicleModel = "Vehicle model must be 100 characters or fewer.";
    }
    if (
      !Number.isInteger(Number(formData.vehicleYear)) ||
      Number(formData.vehicleYear) < 1900 ||
      Number(formData.vehicleYear) > 2100
    ) {
      newErrors.vehicleYear = "Vehicle year must be an integer from 1900 to 2100.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOpenModal = (record?: DeviceVehicleRecord) => {
    setIsEditMode(Boolean(record));
    setSelectedRecord(record ?? null);
    setFormData(record ? {
      deviceId: record.deviceId,
      deviceStatus: record.deviceStatus,
      registrationNumber: record.registrationNumber,
      vehicleYear: record.vehicleYear,
      vehicleMake: record.vehicleMake,
      vehicleModel: record.vehicleModel,
      vehicleStatus: record.vehicleStatus,
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
    const deviceStatus = formData.deviceStatus;
    const vehiclePayload = {
      plateNumber: formData.registrationNumber.trim().toUpperCase(),
      make: formData.vehicleMake.trim(),
      model: formData.vehicleModel.trim(),
      year: Number(formData.vehicleYear),
      status: formData.vehicleStatus,
    };
    const devicePayload = { identifier: formData.deviceId.trim(), status: deviceStatus };
    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (isEditMode && selectedRecord) {
        if (!selectedRecord.deviceRecordId || !selectedRecord.vehicleRecordId) {
          throw new Error("The device or vehicle record ID is missing; no update was sent.");
        }
        const [deviceResult, vehicleResult] = await Promise.allSettled([
          fetch(`/api/v1/devices/${encodeURIComponent(selectedRecord.deviceRecordId)}`, {
            method: "PUT", headers, body: JSON.stringify(devicePayload),
          }),
          fetch(`/api/v1/vehicles/${encodeURIComponent(selectedRecord.vehicleRecordId)}`, {
            method: "PUT", headers, body: JSON.stringify(vehiclePayload),
          }),
        ]);
        const deviceResponse = deviceResult.status === "fulfilled" ? deviceResult.value : null;
        const vehicleResponse = vehicleResult.status === "fulfilled" ? vehicleResult.value : null;
        const deviceUpdated = Boolean(deviceResponse?.ok);
        const vehicleUpdated = Boolean(vehicleResponse?.ok);
        if (!deviceUpdated || !vehicleUpdated) {
          setRetryRecords((previous) => previous + 1);
          const failedResponse = deviceResponse && !deviceResponse.ok
            ? deviceResponse
            : vehicleResponse && !vehicleResponse.ok
              ? vehicleResponse
              : null;
          const failureMessage = failedResponse
            ? await errorForStatus(failedResponse, "update")
            : "The server could not be reached while saving the records.";
          throw new Error(
            deviceUpdated || vehicleUpdated
              ? `${failureMessage} One record may already have been updated; the registry is being refreshed.`
              : failureMessage,
          );
        }
        setRetryRecords((previous) => previous + 1);
        setToastMessage("Device & Vehicle updated successfully");
      } else {
        const response = await fetch("/api/v1/setup/vehicle-device", {
          method: "POST",
          headers,
          body: JSON.stringify({ vehicle: vehiclePayload, device: devicePayload }),
        });
        if (!response.ok) throw new Error(await errorForStatus(response, "create"));
        const payload: unknown = await response.json();
        const data =
          payload && typeof payload === "object" && "data" in payload
            ? payload.data
            : undefined;
        const device =
          data && typeof data === "object" && "device" in data
            ? data.device
            : undefined;
        const vehicle =
          data && typeof data === "object" && "vehicle" in data
            ? data.vehicle
            : undefined;
        if (
          !payload ||
          typeof payload !== "object" ||
          !("success" in payload) ||
          payload.success !== true ||
          !device ||
          typeof device !== "object" ||
          !("id" in device) ||
          typeof device.id !== "string" ||
          !vehicle ||
          typeof vehicle !== "object" ||
          !("id" in vehicle) ||
          typeof vehicle.id !== "string" ||
          !("vehicleId" in device) ||
          device.vehicleId !== vehicle.id
        ) {
          setRetryRecords((previous) => previous + 1);
          throw new Error("The server response did not confirm a correctly linked device and vehicle. The registry is being refreshed.");
        }
        setRetryRecords((previous) => previous + 1);
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
                <span className="metric-value text-danger">{isLoadingRecords ? "—" : records.filter((record) => record.vehicleStatus.toLowerCase() === "maintenance").length}</span>
                <span className="metric-sub text-danger">Vehicles in maintenance</span>
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
                    placeholder="Search device, vehicle ID, registration, make, or model..."
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
                    <th>DEVICE IDENTIFIER</th>
                    <th>VEHICLE RECORD ID</th>
                    <th>REGISTRATION NUMBER</th>
                    <th>MAKE / MODEL</th>
                    <th>DEVICE STATUS</th>
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
                      <td><strong className="code-badge vehicle-badge">{highlightMatch(rec.vehicleId, debouncedSearch)}</strong></td>
                      <td className="mono-text">{highlightMatch(rec.registrationNumber, debouncedSearch)}</td>
                      <td>{highlightMatch(`${rec.vehicleMake} ${rec.vehicleModel}`.trim(), debouncedSearch)}</td>
                      <td><span className={`status-pill ${rec.deviceStatus.toLowerCase()}`}>{displayValue(rec.deviceStatus)}</span></td>
                      <td><small className="text-muted">{formatDate(rec.updatedAt || rec.createdAt)}</small></td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-button" title="View record" aria-label="View record" onClick={() => { setDetailError(null); setSelectedRecord(rec); }}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2"/></svg>
                          </button>
                          <button className="icon-button" title={rec.vehicleRecordId ? "Edit record" : "Cannot edit without an associated vehicle"} aria-label="Edit record" disabled={!rec.vehicleRecordId} onClick={() => handleOpenModal(rec)}>
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
                    Create or update a device and its associated vehicle using fields supported by the API.
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
                  <strong>Request Error</strong>
                  <p>{apiErrorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="modal-form">
              <div className="modal-body">
                {/* Device fields supported by the API */}
                <fieldset className="form-section">
                  <legend className="section-legend">
                    <span className="section-number">1</span>
                    <span className="section-title">DEVICE</span>
                  </legend>

                  <div className="form-grid">
                    <div className="field-group">
                      <div className="label-row">
                        <label htmlFor="deviceId">Device identifier <span className="req">*</span></label>
                        {formData.deviceId.trim() && !errors.deviceId && (
                          <span className="validated-tag">Identifier entered</span>
                        )}
                      </div>
                      <input
                        id="deviceId"
                        type="text"
                        placeholder="IMEI, serial number, or device ID"
                        value={formData.deviceId}
                        maxLength={100}
                        onChange={(e) => handleInputChange("deviceId", e.target.value)}
                        className={errors.deviceId ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.deviceId && <span className="field-error-msg">{errors.deviceId}</span>}
                    </div>

                    <div className="field-group">
                      <label htmlFor="deviceStatus">Device status</label>
                      <select
                        id="deviceStatus"
                        value={formData.deviceStatus}
                        onChange={(e) => handleInputChange("deviceStatus", e.target.value)}
                        className={errors.deviceStatus ? "input-error" : ""}
                        disabled={isSubmitting}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      {errors.deviceStatus && <span className="field-error-msg">{errors.deviceStatus}</span>}
                    </div>
                  </div>
                </fieldset>

                {/* Vehicle fields supported by the API */}
                <fieldset className="form-section">
                  <legend className="section-legend">
                    <span className="section-number">2</span>
                    <span className="section-title">ASSOCIATED VEHICLE</span>
                  </legend>

                  <div className="form-grid">
                    <div className="field-group">
                      <label htmlFor="registrationNumber">Registration Number <span className="req">*</span></label>
                      <input
                        id="registrationNumber"
                        type="text"
                        placeholder="e.g. TN 09 BK 4321"
                        value={formData.registrationNumber}
                        onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                        maxLength={20}
                        className={errors.registrationNumber ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.registrationNumber && <span className="field-error-msg">{errors.registrationNumber}</span>}
                    </div>

                    <div className="field-group">
                      <label htmlFor="vehicleMake">Make <span className="req">*</span></label>
                      <input
                        id="vehicleMake"
                        type="text"
                        value={formData.vehicleMake}
                        onChange={(e) => handleInputChange("vehicleMake", e.target.value)}
                        maxLength={100}
                        className={errors.vehicleMake ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.vehicleMake && <span className="field-error-msg">{errors.vehicleMake}</span>}
                    </div>

                    <div className="field-group">
                      <label htmlFor="vehicleModel">Model <span className="req">*</span></label>
                      <input
                        id="vehicleModel"
                        type="text"
                        value={formData.vehicleModel}
                        onChange={(e) => handleInputChange("vehicleModel", e.target.value)}
                        maxLength={100}
                        className={errors.vehicleModel ? "input-error" : ""}
                        disabled={isSubmitting}
                      />
                      {errors.vehicleModel && <span className="field-error-msg">{errors.vehicleModel}</span>}
                    </div>

                    <div className="field-group">
                      <label htmlFor="vehicleYear">Year <span className="req">*</span></label>
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

                    <div className="field-group">
                      <label htmlFor="vehicleStatus">Vehicle status</label>
                      <select
                        id="vehicleStatus"
                        value={formData.vehicleStatus}
                        onChange={(e) => handleInputChange("vehicleStatus", e.target.value)}
                        disabled={isSubmitting}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Constraint Verification Banner */}
                <div className="constraint-banner">
                  <div className="shield-icon" aria-hidden="true">🛡️</div>
                  <div>
                    <strong>Identifiers are checked by the server.</strong>
                    <p>Creation saves both records together. The server enforces unique device identifiers and vehicle registration numbers.</p>
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
                <button className="secondary-button" disabled={!selectedRecord.vehicleRecordId} onClick={() => handleOpenModal(selectedRecord)}>Edit</button>
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
                  <div><dt>Device identifier</dt><dd>{displayValue(selectedRecord.deviceId)}</dd></div>
                  <div><dt>Device Status</dt><dd><span className={`status-pill ${selectedRecord.deviceStatus.toLowerCase()}`}>{displayValue(selectedRecord.deviceStatus)}</span></dd></div>
                </dl>
              </section>
              <section className="detail-section">
                <h3>Vehicle Profile</h3>
                <dl>
                  <div><dt>Vehicle record ID</dt><dd>{displayValue(selectedRecord.vehicleId)}</dd></div>
                  <div><dt>Registration Number</dt><dd>{displayValue(selectedRecord.registrationNumber)}</dd></div>
                  <div><dt>Make</dt><dd>{displayValue(selectedRecord.vehicleMake)}</dd></div>
                  <div><dt>Model</dt><dd>{displayValue(selectedRecord.vehicleModel)}</dd></div>
                  <div><dt>Year</dt><dd>{displayValue(selectedRecord.vehicleYear)}</dd></div>
                  <div><dt>Vehicle status</dt><dd>{displayValue(selectedRecord.vehicleStatus)}</dd></div>
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
