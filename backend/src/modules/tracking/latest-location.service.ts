// Latest vehicle location service.
import type { EntityManager } from "@mikro-orm/postgresql";
import * as repository from "./tracking.repository.js";
import type { LatestVehicleLocation } from "./tracking.types.js";

/**
 * Current live positions for the map's initial load and for clients that reconnect
 * after missing realtime events. Unknown vehicle IDs are simply absent from the result.
 */
export async function getLatestLocations(
  em: EntityManager,
  vehicleIds?: string[],
): Promise<LatestVehicleLocation[]> {
  const rows = await repository.findLatestLocations(em, vehicleIds);
  return rows.map((row) => ({
    vehicleId: row.vehicleId,
    latitude: row.latitude,
    longitude: row.longitude,
    speed: row.speed ?? null,
    heading: row.heading ?? null,
    recordedAt: row.recordedAt,
    updatedAt: row.updatedAt,
  }));
}
