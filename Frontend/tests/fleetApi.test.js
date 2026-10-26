import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FleetApiError,
  createVehicleDevice,
  deleteDevice,
  deleteVehicle,
  getDevice,
  getLatestLocations,
  getLocationReport,
  getVehicle,
  ingestLocation,
  listDevices,
  listVehicles,
  updateDevice,
  updateVehicle
} from "../src/services/fleetApi";

const session = { accessToken: "test-token", tokenType: "Bearer" };

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body === null ? "" : JSON.stringify(body))
  };
}

function requestAt(index = 0) {
  return vi.mocked(fetch).mock.calls[index];
}

beforeEach(() => {
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout
  });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fleet API client", () => {
  it("loads all paginated device records with the bearer session", async () => {
    fetch
      .mockResolvedValueOnce(response({ data: [{ id: "d-1" }], meta: { total: 2 } }))
      .mockResolvedValueOnce(response({ data: [{ id: "d-2" }], meta: { total: 2 } }));

    await expect(listDevices(session)).resolves.toEqual([{ id: "d-1" }, { id: "d-2" }]);
    expect(requestAt(0)[0]).toBe("/api/devices?page=1&limit=100");
    expect(requestAt(1)[0]).toBe("/api/devices?page=2&limit=100");
    expect(requestAt(0)[1].headers.Authorization).toBe("Bearer test-token");
  });

  it("loads vehicle records from the documented collection endpoint", async () => {
    fetch.mockResolvedValueOnce(response({ data: [{ id: "v-1" }], meta: { total: 1 } }));

    await expect(listVehicles(session)).resolves.toEqual([{ id: "v-1" }]);
    expect(requestAt()[0]).toBe("/api/vehicles?page=1&limit=100");
  });

  it("uses documented CRUD paths and payloads", async () => {
    fetch
      .mockResolvedValueOnce(response({ data: { id: "d-1" } }))
      .mockResolvedValueOnce(response({ data: { id: "v-1" } }))
      .mockResolvedValueOnce(response({ data: { id: "d-1" } }))
      .mockResolvedValueOnce(response({ data: { id: "v-1" } }))
      .mockResolvedValueOnce(response(null, 204))
      .mockResolvedValueOnce(response(null, 204));

    await getDevice(session, "d-1");
    await getVehicle(session, "v-1");
    await updateDevice(session, "d-1", { identifier: "GPS-1", status: "active" });
    await updateVehicle(session, "v-1", { plateNumber: "TN01", make: "Tata", model: "Prima", year: 2024, status: "active" });
    await deleteDevice(session, "d-1");
    await deleteVehicle(session, "v-1");

    expect(requestAt(0)[0]).toBe("/api/devices/d-1");
    expect(requestAt(1)[0]).toBe("/api/vehicles/v-1");
    expect(requestAt(2)[1].method).toBe("PUT");
    expect(JSON.parse(requestAt(2)[1].body)).toEqual({ identifier: "GPS-1", status: "active" });
    expect(requestAt(3)[1].method).toBe("PUT");
    expect(requestAt(4)[1].method).toBe("DELETE");
    expect(requestAt(5)[1].method).toBe("DELETE");
  });

  it("creates a linked device and vehicle through the atomic setup endpoint", async () => {
    fetch.mockResolvedValueOnce(response({ success: true, data: { device: {}, vehicle: {} } }, 201));
    const payload = { vehicle: { plateNumber: "TN01", make: "Tata", model: "Prima", year: 2024 }, device: { identifier: "GPS-1", status: "active" } };

    await createVehicleDevice(session, payload);
    expect(requestAt()[0]).toBe("/api/v1/setup/vehicle-device");
    expect(requestAt()[1].method).toBe("POST");
    expect(JSON.parse(requestAt()[1].body)).toEqual(payload);
  });

  it("uses GET latest for all positions and POST latest for selected vehicles", async () => {
    fetch
      .mockResolvedValueOnce(response({ data: [{ vehicleId: "v-1" }] }))
      .mockResolvedValueOnce(response({ data: [{ vehicleId: "v-2" }] }));

    await getLatestLocations(session);
    await getLatestLocations(session, [" v-2 "]);
    expect(requestAt(0)[0]).toBe("/api/v1/tracking/latest");
    expect(requestAt(1)[0]).toBe("/api/v1/tracking/latest");
    expect(requestAt(1)[1].method).toBe("POST");
    expect(JSON.parse(requestAt(1)[1].body)).toEqual({ vehicleIds: ["v-2"] });
  });

  it("posts normalized location ingest data without changing the payload", async () => {
    fetch.mockResolvedValueOnce(response({ success: true, data: {} }, 201));
    const payload = { deviceIdentifier: "GPS-1", recordedAt: "2026-10-24T00:00:00.000Z", latitude: 1, longitude: 2, speed: 30 };

    await ingestLocation(session, payload);
    expect(requestAt()[0]).toBe("/api/v1/tracking/ingest");
    expect(requestAt()[1].method).toBe("POST");
    expect(JSON.parse(requestAt()[1].body)).toEqual(payload);
  });

  it("serializes report filters and validates the report envelope", async () => {
    fetch.mockResolvedValueOnce(response({ success: true, data: [{ vehicleId: "v-1" }] }));
    const filters = { from: "2026-10-01T00:00:00.000Z", to: "2026-10-02T00:00:00.000Z", vehicleId: "v-1", speedUnit: "mph", limit: 100 };

    await expect(getLocationReport(session, filters)).resolves.toEqual([{ vehicleId: "v-1" }]);
    expect(requestAt()[0]).toContain("/api/v1/reports/locations?");
    expect(requestAt()[0]).toContain("from=2026-10-01T00%3A00%3A00.000Z");
    expect(requestAt()[0]).toContain("vehicleId=v-1");
    expect(requestAt()[0]).toContain("speedUnit=mph");
  });

  it("exposes HTTP status and server message for failed requests", async () => {
    fetch.mockResolvedValueOnce(response({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401));

    await expect(getLatestLocations(session)).rejects.toMatchObject({
      name: "FleetApiError",
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized"
    });
    await expect(getLatestLocations(session)).rejects.toBeInstanceOf(FleetApiError);
  });
});