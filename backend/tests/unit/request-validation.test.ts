// Request body limits and field-level validation messages.
import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { parseLoginInput } from "../../src/modules/auth/auth.schema.js";
import {
  parseDeviceCreate,
  parseDeviceUpdate,
} from "../../src/modules/devices/device.schema.js";
import { parseLocationReportFilters } from "../../src/modules/reports/report.schema.js";
import {
  parseVehicleCreate,
  parseVehicleUpdate,
} from "../../src/modules/vehicles/vehicle.schema.js";

describe("request bodies", () => {
  const app = createApp();
  const oversized = JSON.stringify({ padding: "x".repeat(1024 * 1024) });

  it.each(["/api/v1/auth/login", "/api/v1/tracking/ingest"])(
    "rejects a body over 1 MB on %s with 413",
    async (path) => {
      const response = await request(app)
        .post(path)
        .set("Content-Type", "application/json")
        .send(oversized);

      expect(response.status).toBe(413);
      expect(response.body).toEqual({
        success: false,
        message: "Request body must not be larger than 1 MB",
        code: "PAYLOAD_TOO_LARGE",
      });
    },
  );

  it("still rejects malformed JSON with 400", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Request body must be valid JSON",
      code: "VALIDATION_ERROR",
    });
  });
});

describe("validation messages", () => {
  const vehicle = {
    plateNumber: "KL01AB1234",
    make: "Tata",
    model: "Ace",
    year: 2020,
  };

  it.each([
    [[], "Request body must be a JSON object"],
    [{ password: "secret" }, "email is required"],
    [
      { email: "admin@fleet", password: "secret" },
      "email must be a valid email address",
    ],
    [{ email: "a@b.co" }, "password is required"],
    [{ email: "a@b.co", password: "" }, "password is required"],
    [{ email: "a@b.co", password: 123456 }, "password must be a string"],
    [
      { email: "a@b.co", password: "x".repeat(129) },
      "password must be at most 128 characters",
    ],
  ])("login %j -> %p", (body, message) => {
    expect(() => parseLoginInput(body)).toThrow(message);
  });

  it.each([
    [{ ...vehicle, plateNumber: undefined }, "plateNumber is required"],
    [{ ...vehicle, plateNumber: 1234 }, "plateNumber must be a string"],
    [
      { ...vehicle, plateNumber: "A".repeat(21) },
      "plateNumber must be 1-20 characters",
    ],
    [{ ...vehicle, make: "  " }, "make must be 1-100 characters"],
    [{ ...vehicle, year: undefined }, "year is required"],
    [{ ...vehicle, year: "2020" }, "year must be an integer from 1900 to 2100"],
    [
      { ...vehicle, status: "deleted" },
      "status must be one of: active, inactive, maintenance",
    ],
  ])("vehicle %j -> %p", (body, message) => {
    expect(() => parseVehicleCreate(body)).toThrow(message);
  });

  it("vehicle update with no fields", () => {
    expect(() => parseVehicleUpdate({})).toThrow(
      "At least one vehicle field is required",
    );
  });

  it.each([
    [{}, "identifier is required"],
    [{ identifier: 42 }, "identifier must be a string"],
    [{ identifier: "x".repeat(101) }, "identifier must be 1-100 characters"],
    [
      { identifier: "GPS-1", vehicleId: "abc" },
      "vehicleId must be a UUID or null",
    ],
    [
      { identifier: "GPS-1", status: "broken" },
      "status must be one of: active, inactive, unassigned",
    ],
  ])("device %j -> %p", (body, message) => {
    expect(() => parseDeviceCreate(body)).toThrow(message);
  });

  it("device update can unassign with vehicleId null", () => {
    expect(parseDeviceUpdate({ vehicleId: null })).toEqual({ vehicleId: null });
  });

  it.each([
    [{ from: "" }, "from must not be empty"],
    [{ to: ["a", "b"] }, "to must be given only once"],
    [
      { from: "yesterday" },
      "from must be an ISO 8601 timestamp with a timezone, e.g. 2026-10-07T05:20:00Z",
    ],
  ])("report filters %j -> %p", (query, message) => {
    expect(() => parseLocationReportFilters(query)).toThrow(message);
  });
});
