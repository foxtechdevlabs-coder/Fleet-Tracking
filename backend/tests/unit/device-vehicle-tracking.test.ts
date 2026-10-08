// Unit tests for Combined Search, Transactional Creation, Validation, and Tracking Resolution.
import { describe, expect, it, jest } from "@jest/globals";
import type { EntityManager } from "@mikro-orm/postgresql";
import {
  ConflictError,
  NotFoundError,
} from "../../src/common/errors/app-errors.js";
import { Device } from "../../src/modules/devices/device.entity.js";
import {
  DeviceRepository,
  listDevicesWithVehicles,
} from "../../src/modules/devices/device.repository.js";
import {
  DeviceService,
  listDevicesWithVehicles as serviceListDevicesWithVehicles,
} from "../../src/modules/devices/device.service.js";
import {
  createDeviceAndVehicle,
  DeviceVehicleService,
} from "../../src/modules/devices/device-vehicle.service.js";
import {
  resolveDeviceForVehicle,
  resolveVehicleForDevice,
  TrackingResolverService,
} from "../../src/modules/tracking/tracking-resolver.service.js";
import { Vehicle } from "../../src/modules/vehicles/vehicle.entity.js";

function createMockDevice(overrides: Partial<Device> = {}): Device {
  const device = new Device();
  device.id = overrides.id ?? "11111111-1111-4111-8111-111111111111";
  device.identifier = overrides.identifier ?? "DEV-001";
  device.vehicleId =
    overrides.vehicleId !== undefined
      ? overrides.vehicleId
      : "22222222-2222-4222-8222-222222222222";
  device.status = overrides.status ?? "active";
  device.lastSeenAt = overrides.lastSeenAt ?? new Date("2026-10-01T10:00:00Z");
  device.createdAt = overrides.createdAt ?? new Date("2026-10-01T09:00:00Z");
  device.updatedAt = overrides.updatedAt ?? new Date("2026-10-01T09:00:00Z");
  return device;
}

function createMockVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const vehicle = new Vehicle();
  vehicle.id = overrides.id ?? "22222222-2222-4222-8222-222222222222";
  vehicle.plateNumber = overrides.plateNumber ?? "KL-07-AB-1234";
  vehicle.make = overrides.make ?? "Toyota";
  vehicle.model = overrides.model ?? "Innova";
  vehicle.year = overrides.year ?? 2024;
  vehicle.status = overrides.status ?? "active";
  vehicle.createdAt = overrides.createdAt ?? new Date("2026-09-01T09:00:00Z");
  vehicle.updatedAt = overrides.updatedAt ?? new Date("2026-09-01T09:00:00Z");
  return vehicle;
}

describe("1. Combined Search & List Query (listDevicesWithVehicles)", () => {
  it("executes SQL LEFT JOIN with filters and projects DeviceVehicleProfile approved fields", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];

    const mockExecute = jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockImplementation(async (sql, params) => {
        capturedSql = sql as string;
        capturedParams = params as unknown[];
        return [
          {
            device_id: "11111111-1111-4111-8111-111111111111",
            device_identifier: "DEV-100",
            device_vehicle_id: "22222222-2222-4222-8222-222222222222",
            device_status: "active",
            device_last_seen_at: "2026-10-01T12:00:00Z",
            device_created_at: "2026-10-01T10:00:00Z",
            device_updated_at: "2026-10-01T10:00:00Z",
            vehicle_id: "22222222-2222-4222-8222-222222222222",
            vehicle_plate_number: "KL-07-AB-1234",
            vehicle_make: "Toyota",
            vehicle_model: "Innova",
            vehicle_year: 2024,
            vehicle_status: "active",
            vehicle_created_at: "2026-09-01T10:00:00Z",
            vehicle_updated_at: "2026-09-01T10:00:00Z",
          },
        ];
      });

    const mockEm = {
      execute: mockExecute,
    } as unknown as EntityManager;

    const results = await listDevicesWithVehicles(mockEm, {
      deviceId: "DEV-100",
      vehicleId: "22222222-2222-4222-8222-222222222222",
      registrationNumber: "KL-07",
    });

    expect(capturedSql).toContain("FROM devices d");
    expect(capturedSql).toContain(
      "LEFT JOIN vehicles v ON d.vehicle_id = v.id",
    );
    expect(capturedSql).toContain("d.identifier ILIKE ?");
    expect(capturedSql).toContain("v.plate_number ILIKE ?");
    expect(capturedParams).toContain("DEV-100");
    expect(capturedParams).toContain("22222222-2222-4222-8222-222222222222");
    expect(capturedParams).toContain("%KL-07%");

    expect(results).toHaveLength(1);
    const profile = results[0];
    expect(profile.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(profile.identifier).toBe("DEV-100");
    expect(profile.vehicle).not.toBeNull();
    expect(profile.vehicle?.plateNumber).toBe("KL-07-AB-1234");
    expect(profile.vehicle?.make).toBe("Toyota");
    expect(profile.vehicle?.year).toBe(2024);
  });

  it("handles null vehicle gracefully when device is unassigned", async () => {
    const mockExecute = jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValue([
        {
          device_id: "33333333-3333-4333-8333-333333333333",
          device_identifier: "DEV-STANDALONE",
          device_vehicle_id: null,
          device_status: "unassigned",
          device_last_seen_at: null,
          device_created_at: "2026-10-02T10:00:00Z",
          device_updated_at: "2026-10-02T10:00:00Z",
          vehicle_id: null,
          vehicle_plate_number: null,
          vehicle_make: null,
          vehicle_model: null,
          vehicle_year: null,
          vehicle_status: null,
          vehicle_created_at: null,
          vehicle_updated_at: null,
        },
      ]);

    const mockEm = {
      execute: mockExecute,
    } as unknown as EntityManager;

    const results = await listDevicesWithVehicles(mockEm);

    expect(results).toHaveLength(1);
    expect(results[0].vehicle).toBeNull();
    expect(results[0].plateNumber).toBeNull();
    expect(results[0].vehicleId).toBeNull();
  });

  it("DeviceRepository class instance delegates to listDevicesWithVehicles", async () => {
    const mockExecute = jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValue([]);
    const mockEm = { execute: mockExecute } as unknown as EntityManager;

    const repo = new DeviceRepository(mockEm);
    const results = await repo.listDevicesWithVehicles({ deviceId: "TEST" });
    expect(results).toEqual([]);
    expect(mockExecute).toHaveBeenCalled();
  });

  it("fallback works when em.execute is not a function", async () => {
    const device = createMockDevice({
      identifier: "DEV-FALLBACK",
      vehicleId: "22222222-2222-4222-8222-222222222222",
    });
    const vehicle = createMockVehicle({
      id: "22222222-2222-4222-8222-222222222222",
      plateNumber: "FALLBACK-PLATE",
    });

    const mockFind = jest
      .fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockImplementation(async (entity) => {
        if (entity === Device) return [device];
        if (entity === Vehicle) return [vehicle];
        return [];
      });

    const mockEm = {
      find: mockFind,
    } as unknown as EntityManager;

    const results = await serviceListDevicesWithVehicles(mockEm, {
      deviceId: "DEV-FALLBACK",
      registrationNumber: "FALLBACK",
    });

    expect(results).toHaveLength(1);
    expect(results[0].identifier).toBe("DEV-FALLBACK");
    expect(results[0].vehicle?.plateNumber).toBe("FALLBACK-PLATE");
  });
});

describe("2. Transactional Creation API (createDeviceAndVehicle)", () => {
  it("saves Vehicle first, assigns vehicle.id to device.vehicleId, and commits transaction", async () => {
    const createdVehicle = createMockVehicle({
      id: "99999999-9999-4999-8999-999999999999",
      plateNumber: "KA-01-MJ-5555",
    });
    const createdDevice = createMockDevice({
      identifier: "IMEI-123456789",
      vehicleId: createdVehicle.id,
    });

    const mockCount = jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockResolvedValue(0);
    const mockCreate = jest
      .fn<(...args: unknown[]) => unknown>()
      .mockImplementation((entity, data: unknown) => {
        const d = (data ?? {}) as Record<string, unknown>;
        if (entity === Vehicle) {
          return { ...createdVehicle, ...d, id: createdVehicle.id };
        }
        return { ...createdDevice, ...d, id: createdDevice.id };
      });
    const mockPersist = jest.fn();
    const mockFlush = jest.fn<() => Promise<void>>().mockResolvedValue();

    const txEm = {
      count: mockCount,
      create: mockCreate,
      persist: mockPersist,
      flush: mockFlush,
    } as unknown as EntityManager;

    const mockTransactional = jest
      .fn<<T>(cb: (em: EntityManager) => Promise<T>) => Promise<T>>()
      .mockImplementation(async (cb) => {
        return cb(txEm);
      });

    const em = {
      transactional: mockTransactional,
    } as unknown as EntityManager;

    const result = await createDeviceAndVehicle(
      em,
      { plateNumber: "KA-01-MJ-5555" },
      { identifier: "IMEI-123456789" },
    );

    expect(mockTransactional).toHaveBeenCalledTimes(1);
    expect(result.vehicle.plateNumber).toBe("KA-01-MJ-5555");
    expect(result.device.vehicleId).toBe(createdVehicle.id);
  });

  it("ensures omitted optional fields fall back gracefully without crashing", async () => {
    const savedVehicleData: Partial<Vehicle> = {};
    const savedDeviceData: Partial<Device> = {};

    const mockCount = jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockResolvedValue(0);
    const mockCreate = jest
      .fn<(...args: unknown[]) => unknown>()
      .mockImplementation((entity, data: unknown) => {
        const d = (data ?? {}) as Record<string, unknown>;
        if (entity === Vehicle) {
          Object.assign(savedVehicleData, d);
          return createMockVehicle(d as Partial<Vehicle>);
        }
        Object.assign(savedDeviceData, d);
        return createMockDevice(d as Partial<Device>);
      });

    const txEm = {
      count: mockCount,
      create: mockCreate,
      persist: jest.fn(),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(),
    } as unknown as EntityManager;

    const em = {
      transactional: jest
        .fn<<T>(cb: (em: EntityManager) => Promise<T>) => Promise<T>>()
        .mockImplementation(async (cb) => cb(txEm)),
    } as unknown as EntityManager;

    const service = new DeviceVehicleService(em);
    await service.createDeviceAndVehicle(
      { plateNumber: "KL-01-ZZ-0001" }, // make, model, year, status omitted
      { identifier: "DEV-OPTIONAL" }, // status omitted
    );

    expect(savedVehicleData.make).toBe("Unknown");
    expect(savedVehicleData.model).toBe("Unknown");
    expect(savedVehicleData.year).toBeDefined();
    expect(savedVehicleData.status).toBe("active");
    expect(savedDeviceData.status).toBe("active");
  });

  it("rolls back transaction if device creation fails after vehicle creation", async () => {
    const mockCount = jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockResolvedValue(0);
    const mockCreate = jest
      .fn<(...args: unknown[]) => unknown>()
      .mockImplementation((entity, data: unknown) => {
        if (entity === Vehicle) {
          return createMockVehicle((data ?? {}) as Partial<Vehicle>);
        }
        throw new Error("Simulated device insert failure");
      });

    const txEm = {
      count: mockCount,
      create: mockCreate,
      persist: jest.fn(),
      flush: jest.fn<() => Promise<void>>().mockResolvedValue(),
    } as unknown as EntityManager;

    const em = {
      transactional: jest
        .fn<<T>(cb: (em: EntityManager) => Promise<T>) => Promise<T>>()
        .mockImplementation(async (cb) => cb(txEm)),
    } as unknown as EntityManager;

    await expect(
      createDeviceAndVehicle(
        em,
        { plateNumber: "KL-01-FAIL" },
        { identifier: "DEV-FAIL" },
      ),
    ).rejects.toThrow("Simulated device insert failure");
  });
});

describe("3. Service-Level Uniqueness & Validation (createDeviceAndVehicle)", () => {
  it("throws ConflictError when vehicle plateNumber already exists", async () => {
    const mockCount = jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockImplementation(async (entity) => {
        if (entity === Vehicle) return 1; // already exists
        return 0;
      });

    const txEm = {
      count: mockCount,
    } as unknown as EntityManager;

    const em = {
      transactional: jest
        .fn<<T>(cb: (em: EntityManager) => Promise<T>) => Promise<T>>()
        .mockImplementation(async (cb) => cb(txEm)),
    } as unknown as EntityManager;

    await expect(
      createDeviceAndVehicle(
        em,
        { plateNumber: "DUPLICATE-PLATE" },
        { identifier: "UNIQUE-DEV" },
      ),
    ).rejects.toThrow(ConflictError);

    await expect(
      createDeviceAndVehicle(
        em,
        { plateNumber: "DUPLICATE-PLATE" },
        { identifier: "UNIQUE-DEV" },
      ),
    ).rejects.toMatchObject({
      code: "PLATE_NUMBER_EXISTS",
      status: 409,
    });
  });

  it("throws ConflictError when device identifier already exists", async () => {
    const mockCount = jest
      .fn<(...args: unknown[]) => Promise<number>>()
      .mockImplementation(async (entity) => {
        if (entity === Device) return 1; // duplicate device identifier
        return 0;
      });

    const txEm = {
      count: mockCount,
    } as unknown as EntityManager;

    const em = {
      transactional: jest
        .fn<<T>(cb: (em: EntityManager) => Promise<T>) => Promise<T>>()
        .mockImplementation(async (cb) => cb(txEm)),
    } as unknown as EntityManager;

    await expect(
      createDeviceAndVehicle(
        em,
        { plateNumber: "UNIQUE-PLATE" },
        { identifier: "DUPLICATE-DEV" },
      ),
    ).rejects.toThrow(ConflictError);

    await expect(
      createDeviceAndVehicle(
        em,
        { plateNumber: "UNIQUE-PLATE" },
        { identifier: "DUPLICATE-DEV" },
      ),
    ).rejects.toMatchObject({
      code: "DEVICE_IDENTIFIER_EXISTS",
      status: 409,
    });
  });
});

describe("4. Tracking Resolution & Fixes", () => {
  describe("resolveDeviceForVehicle", () => {
    it("returns device when relationship exists", async () => {
      const vehicle = createMockVehicle({
        id: "22222222-2222-4222-8222-222222222222",
      });
      const device = createMockDevice({ vehicleId: vehicle.id });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity) => {
          if (entity === Vehicle) return vehicle;
          if (entity === Device) return device;
          return null;
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      const result = await resolveDeviceForVehicle(em, vehicle.id);
      expect(result.id).toBe(device.id);
      expect(result.identifier).toBe(device.identifier);
    });

    it("throws NotFoundError when vehicle does not exist", async () => {
      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(null);
      const em = { findOne: mockFindOne } as unknown as EntityManager;

      await expect(
        resolveDeviceForVehicle(em, "non-existent-vehicle-id"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when vehicle exists but has no device assigned", async () => {
      const vehicle = createMockVehicle({
        id: "22222222-2222-4222-8222-222222222222",
      });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity) => {
          if (entity === Vehicle) return vehicle;
          return null; // no device found for this vehicle
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      await expect(resolveDeviceForVehicle(em, vehicle.id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("resolveVehicleForDevice", () => {
    it("resolves vehicle by device UUID", async () => {
      const vehicle = createMockVehicle({
        id: "22222222-2222-4222-8222-222222222222",
      });
      const device = createMockDevice({
        id: "11111111-1111-4111-8111-111111111111",
        vehicleId: vehicle.id,
      });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity) => {
          if (entity === Device) return device;
          if (entity === Vehicle) return vehicle;
          return null;
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      const result = await resolveVehicleForDevice(em, device.id);
      expect(result.id).toBe(vehicle.id);
      expect(result.plateNumber).toBe(vehicle.plateNumber);
    });

    it("resolves vehicle by device identifier string (IMEI)", async () => {
      const vehicle = createMockVehicle({
        id: "22222222-2222-4222-8222-222222222222",
      });
      const device = createMockDevice({
        identifier: "IMEI-8675309",
        vehicleId: vehicle.id,
      });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity, where: unknown) => {
          const w = (where ?? {}) as Record<string, unknown>;
          if (entity === Device && w.identifier === "IMEI-8675309")
            return device;
          if (entity === Vehicle && w.id === vehicle.id) return vehicle;
          return null;
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      const result = await resolveVehicleForDevice(em, "IMEI-8675309");
      expect(result.plateNumber).toBe(vehicle.plateNumber);
    });

    it("throws NotFoundError when device does not exist", async () => {
      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue(null);
      const em = { findOne: mockFindOne } as unknown as EntityManager;

      await expect(resolveVehicleForDevice(em, "NON-EXISTENT")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError when device is not assigned to any vehicle", async () => {
      const unassignedDevice = createMockDevice({ vehicleId: null });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity) => {
          if (entity === Device) return unassignedDevice;
          return null;
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      await expect(
        resolveVehicleForDevice(em, unassignedDevice.id),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when vehicle reference is broken", async () => {
      const orphanDevice = createMockDevice({
        vehicleId: "44444444-4444-4444-4444-444444444444",
      });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity) => {
          if (entity === Device) return orphanDevice;
          if (entity === Vehicle) return null; // vehicle does not exist
          return null;
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      await expect(
        resolveVehicleForDevice(em, orphanDevice.id),
      ).rejects.toThrow(NotFoundError);
    });

    it("TrackingResolverService and DeviceService class instances resolve correctly", async () => {
      const vehicle = createMockVehicle();
      const device = createMockDevice({ vehicleId: vehicle.id });

      const mockFindOne = jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockImplementation(async (entity) => {
          if (entity === Vehicle) return vehicle;
          if (entity === Device) return device;
          return null;
        });

      const em = { findOne: mockFindOne } as unknown as EntityManager;

      const resolver = new TrackingResolverService(em);
      expect((await resolver.resolveDeviceForVehicle(vehicle.id)).id).toBe(
        device.id,
      );
      expect((await resolver.resolveVehicleForDevice(device.id)).id).toBe(
        vehicle.id,
      );

      const deviceService = new DeviceService(em);
      expect((await deviceService.resolveDeviceForVehicle(vehicle.id)).id).toBe(
        device.id,
      );
      expect((await deviceService.resolveVehicleForDevice(device.id)).id).toBe(
        vehicle.id,
      );
    });
  });
});
