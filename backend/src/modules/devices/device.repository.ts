// Device persistence operations.
import { RequestContext } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { Vehicle } from "../vehicles/vehicle.entity.js";
import type { VehicleProfile } from "../vehicles/vehicle.types.js";
import { Device } from "./device.entity.js";
import type {
  CreateDeviceInput,
  DeviceInput,
  DeviceSearchFilters,
  DeviceUpdate,
  DeviceVehicleProfile,
} from "./device.types.js";
import { toDeviceVehicleProfile } from "./device.types.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isEntityManager(val: unknown): val is EntityManager {
  return (
    typeof val === "object" &&
    val !== null &&
    ("find" in val ||
      "findOne" in val ||
      "fork" in val ||
      "getConnection" in val ||
      "execute" in val ||
      "transactional" in val)
  );
}

export function listDevices(
  em: EntityManager,
  limit: number,
  offset: number,
): Promise<[Device[], number]> {
  return em.findAndCount(
    Device,
    {},
    { orderBy: { createdAt: "DESC" }, limit, offset },
  );
}

export function findDevice(
  em: EntityManager,
  id: string,
): Promise<Device | null> {
  return em.findOne(Device, { id });
}

/** Find a device by its unique identifier (IMEI / serial). */
export function findByIdentifier(
  em: EntityManager,
  identifier: string,
): Promise<Device | null> {
  return em.findOne(Device, { identifier });
}

/** Find the device currently linked to the given vehicle, if any. */
export function findByVehicleId(
  em: EntityManager,
  vehicleId: string,
): Promise<Device | null> {
  return em.findOne(Device, { vehicleId });
}

/** Check whether a device with the given identifier already exists. */
export async function existsByIdentifier(
  em: EntityManager,
  identifier: string,
): Promise<boolean> {
  const count = await em.count(Device, { identifier });
  return count > 0;
}

export async function createDevice(
  em: EntityManager,
  input: DeviceInput | CreateDeviceInput,
): Promise<Device> {
  const now = new Date();
  const device = em.create(Device, {
    ...input,
    vehicleId: input.vehicleId ?? null,
    status: input.status ?? "unassigned",
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  });
  em.persist(device);
  await em.flush();
  return device;
}

export async function updateDevice(
  em: EntityManager,
  device: Device,
  input: DeviceUpdate,
): Promise<Device> {
  em.assign(device, input);
  await em.flush();
  return device;
}

export async function deleteDevice(
  em: EntityManager,
  device: Device,
): Promise<void> {
  em.remove(device);
  await em.flush();
}

/**
 * List devices with their assigned vehicle data, supporting filtering.
 *
 * @param filters Criteria for device identifier, vehicle UUID, and plate number (ILIKE).
 * @returns Array of safe DeviceVehicleProfile objects.
 */
export function listDevicesWithVehicles(
  filters: DeviceSearchFilters,
): Promise<DeviceVehicleProfile[]>;
export function listDevicesWithVehicles(
  em: EntityManager,
  filters?: DeviceSearchFilters,
): Promise<DeviceVehicleProfile[]>;
export async function listDevicesWithVehicles(
  emOrFilters?: EntityManager | DeviceSearchFilters,
  maybeFilters?: DeviceSearchFilters,
): Promise<DeviceVehicleProfile[]> {
  let em: EntityManager | undefined;
  let filters: DeviceSearchFilters = {};

  if (isEntityManager(emOrFilters)) {
    em = emOrFilters;
    filters = maybeFilters ?? {};
  } else if (emOrFilters) {
    filters = emOrFilters;
    em = RequestContext.getEntityManager() as EntityManager | undefined;
  } else {
    em = RequestContext.getEntityManager() as EntityManager | undefined;
  }

  if (!em) {
    throw new Error(
      "EntityManager must be provided or available in RequestContext",
    );
  }

  // When em.execute is available, execute a SQL LEFT JOIN query
  if (typeof em.execute === "function") {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const deviceId = (filters.deviceId ?? filters.identifier)?.trim();
    if (deviceId) {
      if (uuidPattern.test(deviceId)) {
        conditions.push("(d.identifier ILIKE ? OR d.id = ?)");
        params.push(deviceId, deviceId);
      } else {
        conditions.push("d.identifier ILIKE ?");
        params.push(deviceId);
      }
    }

    const vehicleId = filters.vehicleId?.trim();
    if (vehicleId) {
      conditions.push("(d.vehicle_id = ? OR v.id = ?)");
      params.push(vehicleId, vehicleId);
    }

    const regNumber = (
      filters.registrationNumber ?? filters.plateNumber
    )?.trim();
    if (regNumber) {
      conditions.push("v.plate_number ILIKE ?");
      params.push(`%${regNumber}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        d.id AS device_id,
        d.identifier AS device_identifier,
        d.vehicle_id AS device_vehicle_id,
        d.status AS device_status,
        d.last_seen_at AS device_last_seen_at,
        d.created_at AS device_created_at,
        d.updated_at AS device_updated_at,
        v.id AS vehicle_id,
        v.plate_number AS vehicle_plate_number,
        v.make AS vehicle_make,
        v.model AS vehicle_model,
        v.year AS vehicle_year,
        v.status AS vehicle_status,
        v.created_at AS vehicle_created_at,
        v.updated_at AS vehicle_updated_at
      FROM devices d
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      ${whereClause}
      ORDER BY d.created_at DESC
    `.trim();

    const rows = await em.execute<Record<string, unknown>[]>(sql, params);

    return rows.map((row): DeviceVehicleProfile => {
      const vehicleProfile: VehicleProfile | null = row.vehicle_id
        ? {
            id: String(row.vehicle_id),
            plateNumber: String(row.vehicle_plate_number),
            make: String(row.vehicle_make),
            model: String(row.vehicle_model),
            year: Number(row.vehicle_year),
            status: String(row.vehicle_status),
            createdAt: new Date(
              row.vehicle_created_at as string | number | Date,
            ),
            updatedAt: new Date(
              row.vehicle_updated_at as string | number | Date,
            ),
          }
        : null;

      return {
        id: String(row.device_id),
        identifier: String(row.device_identifier),
        vehicleId: row.device_vehicle_id ? String(row.device_vehicle_id) : null,
        status: String(row.device_status),
        lastSeenAt: row.device_last_seen_at
          ? new Date(row.device_last_seen_at as string | number | Date)
          : null,
        createdAt: new Date(row.device_created_at as string | number | Date),
        updatedAt: new Date(row.device_updated_at as string | number | Date),
        vehicle: vehicleProfile,
        plateNumber: vehicleProfile?.plateNumber ?? null,
        make: vehicleProfile?.make ?? null,
        model: vehicleProfile?.model ?? null,
        year: vehicleProfile?.year ?? null,
      };
    });
  }

  // Fallback for mock environments without em.execute
  return executeMockFallback(em, filters);
}

async function executeMockFallback(
  em: EntityManager,
  filters: DeviceSearchFilters,
): Promise<DeviceVehicleProfile[]> {
  const deviceWhere: Record<string, unknown> = {};
  const deviceId = (filters.deviceId ?? filters.identifier)?.trim();
  if (deviceId) {
    if (uuidPattern.test(deviceId)) {
      deviceWhere.$or = [{ identifier: deviceId }, { id: deviceId }];
    } else {
      deviceWhere.identifier = deviceId;
    }
  }
  if (filters.vehicleId) {
    deviceWhere.vehicleId = filters.vehicleId.trim();
  }

  const devices = await em.find(Device, deviceWhere, {
    orderBy: { createdAt: "DESC" },
  });

  const regNumber = (filters.registrationNumber ?? filters.plateNumber)?.trim();
  const vehicleIds = devices
    .map((d) => d.vehicleId)
    .filter((id): id is string => Boolean(id));

  const vehicles =
    vehicleIds.length > 0
      ? await em.find(Vehicle, { id: { $in: vehicleIds } })
      : [];

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  const results: DeviceVehicleProfile[] = [];
  for (const device of devices) {
    const vehicle = device.vehicleId
      ? (vehicleMap.get(device.vehicleId) ?? null)
      : null;
    if (regNumber) {
      if (
        !vehicle?.plateNumber.toLowerCase().includes(regNumber.toLowerCase())
      ) {
        continue;
      }
    }
    results.push(toDeviceVehicleProfile(device, vehicle));
  }

  return results;
}

export class DeviceRepository {
  constructor(private readonly em: EntityManager) {}

  listDevices(limit: number, offset: number): Promise<[Device[], number]> {
    return listDevices(this.em, limit, offset);
  }

  findDevice(id: string): Promise<Device | null> {
    return findDevice(this.em, id);
  }

  findByIdentifier(identifier: string): Promise<Device | null> {
    return findByIdentifier(this.em, identifier);
  }

  findByVehicleId(vehicleId: string): Promise<Device | null> {
    return findByVehicleId(this.em, vehicleId);
  }

  existsByIdentifier(identifier: string): Promise<boolean> {
    return existsByIdentifier(this.em, identifier);
  }

  createDevice(input: DeviceInput | CreateDeviceInput): Promise<Device> {
    return createDevice(this.em, input);
  }

  updateDevice(device: Device, input: DeviceUpdate): Promise<Device> {
    return updateDevice(this.em, device, input);
  }

  deleteDevice(device: Device): Promise<void> {
    return deleteDevice(this.em, device);
  }

  listDevicesWithVehicles(
    filters: DeviceSearchFilters = {},
  ): Promise<DeviceVehicleProfile[]> {
    return listDevicesWithVehicles(this.em, filters);
  }
}
