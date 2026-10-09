// Location report queries.
import type { FilterQuery } from "@mikro-orm/core";
import type { EntityManager } from "@mikro-orm/postgresql";
import { LocationHistory } from "../tracking/location.entity.js";
import type { LocationReportQuery } from "./report.types.js";

export function findLocationReport(
  em: EntityManager,
  filters: LocationReportQuery,
): Promise<LocationHistory[]> {
  const where: FilterQuery<LocationHistory> = {};
  if (filters.from || filters.to) {
    where.recordedAt = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.deviceId) where.deviceId = filters.deviceId;

  return em.find(LocationHistory, where, {
    orderBy: { recordedAt: "ASC" },
  });
}
