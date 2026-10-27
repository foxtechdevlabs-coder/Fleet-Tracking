import type {
  Credentials,
  DevicePayload,
  DeviceRecord,
  IngestPayload,
  LatestLocation,
  LocationReportFilters,
  LocationReportRecord,
  VehiclePayload,
  VehicleRecord
} from "../types/fleet";

const apiOrigin = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const apiRoot = `${apiOrigin}/api`;
const requestTimeoutMs = 15000;

export class FleetApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = "") {
    super(message);
    this.name = "FleetApiError";
    this.status = status;
    this.code = code;
  }
}

interface ResponseBody {
  data?: unknown;
  meta?: { total?: unknown };
  message?: string;
  code?: string;
}

interface RequestOptions extends Omit<RequestInit, "headers" | "signal"> {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function messageForStatus(status: number, serverMessage?: string): string {
  if (serverMessage) return serverMessage;
  switch (status) {
    case 400: return "The server rejected the submitted fields. Check the values and try again.";
    case 401: return "Authentication is required. Please sign in again.";
    case 403: return "You do not have permission to perform this action.";
    case 404: return "The requested device or vehicle was not found.";
    case 409: return "A device identifier or vehicle registration number is already in use.";
    case 500: return "The fleet service encountered an error. Please try again later.";
    default: return status ? `Request failed (${status}).` : "Unable to connect to the fleet service.";
  }
}

async function request(path: string, session: Credentials, options: RequestOptions = {}): Promise<ResponseBody | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  const externalSignal = options.signal;
  const abortRequest = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortRequest, { once: true });
  }

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `${session.tokenType} ${session.accessToken}`,
        ...options.headers
      }
    });
    let body: ResponseBody | null = null;
    if (response.status !== 204) {
      const responseText = await response.text();
      if (responseText) {
        try { body = JSON.parse(responseText) as ResponseBody; } catch { body = null; }
      }
    }
    if (!response.ok) {
      throw new FleetApiError(messageForStatus(response.status, body?.message), response.status, body?.code || "");
    }
    return body;
  } catch (error) {
    if (error instanceof FleetApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FleetApiError("The fleet service took too long to respond. Please try again.");
    }
    if (error instanceof TypeError) throw new FleetApiError("Unable to connect to the fleet service. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortRequest);
  }
}

function collectionData<T>(response: ResponseBody | null): T[] {
  if (!Array.isArray(response?.data)) throw new FleetApiError("The fleet service returned an invalid records response.");
  return response.data as T[];
}

async function listAll<T>(resource: string, session: Credentials, signal?: AbortSignal): Promise<T[]> {
  const pageSize = 100;
  const records: T[] = [];
  let page = 1;
  let total: number | null = null;
  do {
    const response = await request(`${resource}?page=${page}&limit=${pageSize}`, session, { signal });
    records.push(...collectionData<T>(response));
    const reportedTotal = response?.meta?.total;
    total = typeof reportedTotal === "number" && Number.isInteger(reportedTotal) ? reportedTotal : null;
    page += 1;
  } while (total !== null ? records.length < total : records.length === pageSize);
  return records;
}

const jsonHeaders = { "Content-Type": "application/json" };

export function listDevices(session: Credentials, signal?: AbortSignal) { return listAll<DeviceRecord>("/devices", session, signal); }
export function listVehicles(session: Credentials, signal?: AbortSignal) { return listAll<VehicleRecord>("/vehicles", session, signal); }
export function getDevice(session: Credentials, id: string, signal?: AbortSignal) { return request(`/devices/${encodeURIComponent(id)}`, session, { signal }); }
export function getVehicle(session: Credentials, id: string, signal?: AbortSignal) { return request(`/vehicles/${encodeURIComponent(id)}`, session, { signal }); }
export function createVehicleDevice(session: Credentials, payload: { vehicle: VehiclePayload; device: DevicePayload }, signal?: AbortSignal) {
  return request("/v1/setup/vehicle-device", session, { method: "POST", signal, headers: jsonHeaders, body: JSON.stringify(payload) });
}
export function updateDevice(session: Credentials, id: string, payload: DevicePayload, signal?: AbortSignal) {
  return request(`/devices/${encodeURIComponent(id)}`, session, { method: "PUT", signal, headers: jsonHeaders, body: JSON.stringify(payload) });
}
export function updateVehicle(session: Credentials, id: string, payload: VehiclePayload, signal?: AbortSignal) {
  return request(`/vehicles/${encodeURIComponent(id)}`, session, { method: "PUT", signal, headers: jsonHeaders, body: JSON.stringify(payload) });
}
export function deleteDevice(session: Credentials, id: string) { return request(`/devices/${encodeURIComponent(id)}`, session, { method: "DELETE" }); }
export function deleteVehicle(session: Credentials, id: string) { return request(`/vehicles/${encodeURIComponent(id)}`, session, { method: "DELETE" }); }

export async function getLatestLocations(session: Credentials, vehicleIds: string[] = [], signal?: AbortSignal): Promise<LatestLocation[]> {
  const normalizedIds = vehicleIds.map((id) => id.trim()).filter(Boolean);
  const response = normalizedIds.length
    ? await request("/v1/tracking/latest", session, {
      method: "POST",
      signal,
      headers: jsonHeaders,
      body: JSON.stringify({ vehicleIds: normalizedIds })
    })
    : await request("/v1/tracking/latest", session, { signal });

  if (!Array.isArray(response?.data)) {
    throw new FleetApiError("The tracking service returned an invalid locations response.");
  }
  return response.data as LatestLocation[];
}

export function ingestLocation(session: Credentials, payload: IngestPayload, signal?: AbortSignal) {
  return request("/v1/tracking/ingest", session, {
    method: "POST",
    signal,
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
}

export async function getLocationReport(session: Credentials, filters: LocationReportFilters = {}, signal?: AbortSignal): Promise<LocationReportRecord[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const response = await request(
    `/v1/reports/locations${query.toString() ? `?${query.toString()}` : ""}`,
    session,
    { signal }
  );
  if (!Array.isArray(response?.data)) {
    throw new FleetApiError("The reports service returned an invalid location report.");
  }
  return response.data as LocationReportRecord[];
}
