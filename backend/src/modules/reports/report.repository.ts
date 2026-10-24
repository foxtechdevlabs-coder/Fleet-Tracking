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

  const options: {
    orderBy: { recordedAt: "ASC"; id: "ASC" };
    limit?: number;
    offset?: number;
  } = {
    orderBy: { recordedAt: "ASC", id: "ASC" },
  };

  if (filters.limit !== undefined) {
    options.limit = filters.limit;
  }
  if (filters.offset !== undefined) {
    options.offset = filters.offset;
  }

  return em.find(LocationHistory, where, options);
}
