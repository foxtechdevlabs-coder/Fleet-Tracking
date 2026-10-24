const apiOrigin = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const apiRoot = `${apiOrigin}/api`;
const requestTimeoutMs = 15000;

export class FleetApiError extends Error {
  constructor(message, status = 0, code = "") {
    super(message);
    this.name = "FleetApiError";
    this.status = status;
    this.code = code;
  }
}

function messageForStatus(status, serverMessage) {
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

async function request(path, session, options = {}) {
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
    let body = null;
    if (response.status !== 204) {
      const responseText = await response.text();
      if (responseText) {
        try { body = JSON.parse(responseText); } catch { body = null; }
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

function collectionData(response) {
  if (!Array.isArray(response?.data)) throw new FleetApiError("The fleet service returned an invalid records response.");
  return response.data;
}

async function listAll(resource, session, signal) {
  const pageSize = 100;
  const records = [];
  let page = 1;
  let total = null;
  do {
    const response = await request(`${resource}?page=${page}&limit=${pageSize}`, session, { signal });
    records.push(...collectionData(response));
    total = Number.isInteger(response?.meta?.total) ? response.meta.total : null;
    page += 1;
  } while (total !== null ? records.length < total : records.length === pageSize);
  return records;
}

export function listDevices(session, signal) { return listAll("/devices", session, signal); }
export function listVehicles(session, signal) { return listAll("/vehicles", session, signal); }
export function getDevice(session, id, signal) { return request(`/devices/${encodeURIComponent(id)}`, session, { signal }); }
export function getVehicle(session, id, signal) { return request(`/vehicles/${encodeURIComponent(id)}`, session, { signal }); }
export function createVehicleDevice(session, payload, signal) {
  return request("/v1/setup/vehicle-device", session, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
export function updateDevice(session, id, payload, signal) {
  return request(`/devices/${encodeURIComponent(id)}`, session, { method: "PUT", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
export function updateVehicle(session, id, payload, signal) {
  return request(`/vehicles/${encodeURIComponent(id)}`, session, { method: "PUT", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
export function deleteDevice(session, id) { return request(`/devices/${encodeURIComponent(id)}`, session, { method: "DELETE" }); }
export function deleteVehicle(session, id) { return request(`/vehicles/${encodeURIComponent(id)}`, session, { method: "DELETE" }); }

export async function getLatestLocations(session, vehicleIds = [], signal) {
  const normalizedIds = vehicleIds.map((id) => id.trim()).filter(Boolean);
  const response = normalizedIds.length
    ? await request("/v1/tracking/latest", session, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleIds: normalizedIds })
    })
    : await request("/v1/tracking/latest", session, { signal });

  if (!Array.isArray(response?.data)) {
    throw new FleetApiError("The tracking service returned an invalid locations response.");
  }
  return response.data;
}

export function ingestLocation(session, payload, signal) {
  return request("/v1/tracking/ingest", session, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getLocationReport(session, filters = {}, signal) {
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
  return response.data;
}