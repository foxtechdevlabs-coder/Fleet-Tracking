import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Cont from "../src/Components/Content/Cont";
import FleetPage from "../src/Pages/Fleet/FleetPage";
import HistoryPage from "../src/Pages/History/HistoryPage";
import SettingsPage from "../src/Pages/Settings/SettingsPage";
import * as fleetApi from "../src/services/fleetApi";

const { logoutMock, sessionMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  sessionMock: { accessToken: "page-test-token", tokenType: "Bearer" as const }
}));
vi.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({ logout: logoutMock }),
  useSession: () => sessionMock
}));

vi.mock("../src/services/fleetApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/fleetApi")>();
  return {
    ...actual,
    getLatestLocations: vi.fn(),
    getLocationReport: vi.fn(),
    getSettings: vi.fn(),
    listDevices: vi.fn(),
    listVehicles: vi.fn()
  };
});

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

beforeEach(() => {
  vi.mocked(fleetApi.getLatestLocations).mockReset();
  vi.mocked(fleetApi.getLocationReport).mockReset();
  vi.mocked(fleetApi.getSettings).mockReset();
  vi.mocked(fleetApi.listDevices).mockReset();
  vi.mocked(fleetApi.listVehicles).mockReset();
  logoutMock.mockReset();
});

afterEach(cleanup);

describe("API-backed pages", () => {
  it("shows loading before the Dashboard API responses arrive", async () => {
    let resolveVehicles: (records: { id: string; plateNumber: string; make: string; model: string; status: string }[]) => void = () => {};
    vi.mocked(fleetApi.listVehicles).mockReturnValueOnce(new Promise((resolve) => { resolveVehicles = resolve; }));
    vi.mocked(fleetApi.listDevices).mockResolvedValueOnce([]);
    vi.mocked(fleetApi.getLatestLocations).mockResolvedValueOnce([]);

    renderPage(<Cont />);
    expect(screen.getByText("Loading dashboard data...")).toBeInTheDocument();

    resolveVehicles([]);
    await screen.findByText("No fleet data available");
  });

  it("renders fleet inventory returned by the vehicle and device APIs", async () => {
    vi.mocked(fleetApi.listDevices).mockResolvedValueOnce([
      { id: "device-record-1", identifier: "gps-live-1", status: "active", vehicleId: "vehicle-live-1" }
    ]);
    vi.mocked(fleetApi.listVehicles).mockResolvedValueOnce([
      { id: "vehicle-live-1", plateNumber: "LIVE-001", make: "Fleet", model: "Van", year: 2025, status: "active" }
    ]);

    renderPage(<FleetPage />);

    expect(await screen.findByText("LIVE-001")).toBeInTheDocument();
    expect(screen.getByText("gps-live-1")).toBeInTheDocument();
  });

  it("shows a clear service error and retries the Fleet API request", async () => {
    vi.mocked(fleetApi.listDevices)
      .mockRejectedValueOnce(new fleetApi.FleetApiError("The device endpoint returned 503.", 503))
      .mockResolvedValueOnce([]);
    vi.mocked(fleetApi.listVehicles).mockResolvedValue([]);

    renderPage(<FleetPage />);

    expect(await screen.findByText("The device endpoint returned 503.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No fleet records")).toBeInTheDocument();
    expect(fleetApi.listDevices).toHaveBeenCalledTimes(2);
  });

  it("renders effective settings returned by the Settings API", async () => {
    vi.mocked(fleetApi.getSettings).mockResolvedValueOnce({
      "general.timezone": "Asia/Kolkata",
      "tracking.speed_unit": "km/h"
    });

    renderPage(<SettingsPage />);

    expect(await screen.findByText("Asia/Kolkata")).toBeInTheDocument();
    expect(screen.getByText("tracking.speed_unit")).toBeInTheDocument();
  });

  it("shows the Settings empty state and allows a refresh", async () => {
    vi.mocked(fleetApi.getSettings).mockResolvedValue({});

    renderPage(<SettingsPage />);

    expect(await screen.findByText("No settings returned")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fleetApi.getSettings).toHaveBeenCalledTimes(2));
  });

  it("renders stored location history returned by the reports API", async () => {
    vi.mocked(fleetApi.getLocationReport).mockResolvedValueOnce([
      { recordedAt: "2026-10-01T10:00:00.000Z", vehicleId: "history-vehicle-1", deviceId: "history-device-1", latitude: 12.5, longitude: 44.25, speed: 20, heading: 90, altitude: 5 }
    ]);

    renderPage(<HistoryPage />);

    expect(await screen.findByText("history-vehicle-1")).toBeInTheDocument();
    expect(screen.getByText("history-device-1")).toBeInTheDocument();
    expect(fleetApi.getLocationReport).toHaveBeenCalledWith(
      { accessToken: "page-test-token", tokenType: "Bearer" },
      { limit: 100, offset: 0 },
      expect.any(AbortSignal)
    );
  });
});
