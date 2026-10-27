import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportResultsTable } from "../src/Components/Reports/ReportResultsTable";
import type { LocationReportRecord } from "../src/types/fleet";

const records: LocationReportRecord[] = [
  { recordedAt: "2026-10-01T10:00:00.000Z", vehicleId: "veh-1", deviceId: "GPS-001", latitude: 13.0827, longitude: 80.2707, speed: 42.5, heading: 90, altitude: 6 },
  { recordedAt: "2026-10-01T10:05:00.000Z", vehicleId: "veh-2", deviceId: "GPS-002", latitude: -33.8688, longitude: 151.2093, speed: 95, heading: null, altitude: null }
];

afterEach(cleanup);

describe("ReportResultsTable", () => {
  it("renders every record with formatted coordinates", () => {
    render(<ReportResultsTable records={records} />);

    expect(screen.getByText("veh-1")).toBeInTheDocument();
    expect(screen.getByText("GPS-002")).toBeInTheDocument();
    expect(screen.getByText("13.08270° N")).toBeInTheDocument();
    expect(screen.getByText("33.86880° S")).toBeInTheDocument();
    expect(screen.getByText("6.0 m")).toBeInTheDocument();
  });

  it("filters rows with the search box", () => {
    render(<ReportResultsTable records={records} />);

    fireEvent.change(screen.getByLabelText("Search within report"), { target: { value: "gps-002" } });

    expect(screen.queryByText("veh-1")).not.toBeInTheDocument();
    expect(screen.getByText("veh-2")).toBeInTheDocument();
  });

  it("labels speeds with the selected unit and flags overspeed", () => {
    render(<ReportResultsTable records={records} speedUnit="mph" timeZone="Asia/Kolkata" />);

    expect(screen.getByText("SPEED (mph)")).toBeInTheDocument();
    expect(screen.getByText("DATE / TIME (Asia/Kolkata)")).toBeInTheDocument();
    expect(screen.getByText("42.5 mph")).toBeInTheDocument();
    expect(screen.getByText("95.0 mph (Overspeed)")).toBeInTheDocument();
    expect(screen.getByText("95.0 mph (Alert >50 mph)")).toBeInTheDocument();
  });

  it("exports the returned records to CSV", async () => {
    let csvBlob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => { csvBlob = blob; return "blob:report"; }),
      revokeObjectURL: vi.fn()
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ReportResultsTable records={records} />);

    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));

    expect(click).toHaveBeenCalledTimes(1);
    // jsdom's Blob has no text() method, so read it with FileReader.
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(csvBlob!);
    });
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe('"DATE / TIME (UTC)","VEHICLE","DEVICE","LATITUDE","LONGITUDE","SPEED (km/h)","HEADING","ALTITUDE (m)"');
    expect(lines[2]).toContain('"veh-2","GPS-002","-33.8688","151.2093","95","",""');
    vi.unstubAllGlobals();
  });
});
