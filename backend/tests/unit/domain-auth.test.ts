// Domain schema and access-token unit tests.
import { describe, expect, it } from "@jest/globals";
import { AppError } from "../../src/common/errors/app-error.js";
import { parseLoginInput } from "../../src/modules/auth/auth.schema.js";
import {
  createAccessToken,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
} from "../../src/modules/auth/auth.service.js";
import { parseDeviceCreate } from "../../src/modules/devices/device.schema.js";
import { parseVehicleDeviceSetup } from "../../src/modules/setup/setup.schema.js";
import { parseVehicleCreate } from "../../src/modules/vehicles/vehicle.schema.js";

describe("vehicle and device request schemas", () => {
  it("normalizes valid vehicle and admin login inputs", () => {
    expect(
      parseVehicleCreate({
        plateNumber: " ab-123 ",
        make: "Ford",
        model: "Transit",
        year: 2024,
      }),
    ).toEqual({
      plateNumber: "AB-123",
      make: "Ford",
      model: "Transit",
      year: 2024,
    });
    expect(
      parseLoginInput({ email: " ADMIN@example.com ", password: "pass" }).email,
    ).toBe("admin@example.com");
  });

  it("rejects invalid vehicle, device, and login fields", () => {
    expect(() =>
      parseVehicleCreate({
        plateNumber: "A",
        make: "Ford",
        model: "Van",
        year: 1800,
      }),
    ).toThrow(AppError);
    expect(() => parseDeviceCreate({ identifier: "" })).toThrow(AppError);
    expect(() =>
      parseDeviceCreate({ identifier: "GPS-1", vehicleId: "invalid" }),
    ).toThrow(AppError);
    expect(() =>
      parseLoginInput({ email: "not-an-email", password: "pass" }),
    ).toThrow(AppError);
  });

  it("validates a complete vehicle-device setup before persistence", () => {
    expect(
      parseVehicleDeviceSetup({
        vehicle: {
          plateNumber: " ab-123 ",
          make: "Ford",
          model: "Transit",
          year: 2024,
        },
        device: { identifier: " GPS-1 " },
      }),
    ).toEqual({
      vehicle: {
        plateNumber: "AB-123",
        make: "Ford",
        model: "Transit",
        year: 2024,
      },
      device: { identifier: "GPS-1", status: "active" },
    });

    expect(() =>
      parseVehicleDeviceSetup({
        vehicle: {
          plateNumber: "AB-123",
          make: "Ford",
          model: "Transit",
          year: 2024,
        },
        device: { identifier: "GPS-1", status: "unassigned" },
      }),
    ).toThrow(AppError);
    expect(() =>
      parseVehicleDeviceSetup({
        vehicle: {
          plateNumber: "AB-123",
          make: "Ford",
          model: "Transit",
          year: 2024,
        },
        device: { identifier: "GPS-1", vehicleId: "some-other-vehicle" },
      }),
    ).toThrow(AppError);
    expect(() =>
      parseVehicleDeviceSetup({
        vehicle: { plateNumber: "AB-123" },
        device: { identifier: "GPS-1" },
      }),
    ).toThrow(AppError);
  });
});

describe("admin credentials", () => {
  it("hashes passwords and issues verifiable, expiring access tokens", async () => {
    const passwordHash = await hashPassword("a-long-test-password");
    expect(await verifyPassword("a-long-test-password", passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword("incorrect-password", passwordHash)).toBe(
      false,
    );

    const issued = createAccessToken({
      id: "3a7f7d5b-75b8-4ab0-89bd-50c13e4d85d6",
      email: "admin@example.com",
      role: "admin",
    });
    expect(verifyAccessToken(issued.token)?.sub).toBe(
      "3a7f7d5b-75b8-4ab0-89bd-50c13e4d85d6",
    );
    expect(verifyAccessToken(`X${issued.token.slice(1)}`)).toBeUndefined();
    expect(
      verifyAccessToken(
        createAccessToken(
          {
            id: "3a7f7d5b-75b8-4ab0-89bd-50c13e4d85d6",
            email: "admin@example.com",
            role: "admin",
          },
          0,
        ).token,
      ),
    ).toBeUndefined();
  });
});
