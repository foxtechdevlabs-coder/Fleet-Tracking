// Tracking ingestion HTTP controller.
import type { RequestHandler } from "express";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import {
  getRealtime,
  safely,
  toVehicleLocationPayload,
} from "../realtime/realtime.service.js";
import { getLatestLocations } from "./latest-location.service.js";
import {
  parseLatestLocationBody,
  parseLatestLocationQuery,
  parseTrackingLocation,
} from "./tracking.schema.js";
import { ingestLocation } from "./tracking.service.js";

export const ingest: RequestHandler = async (req, res) => {
  const input = parseTrackingLocation(req.body);
  const result = await ingestLocation(getEntityManager(req), input);

  // ingestLocation() has committed at this point. Broadcast only readings that became
  // the live position: duplicates and older (out-of-order) readings are history only.
  if (!result.duplicate && result.latestUpdated) {
    const realtime = getRealtime(req);
    if (realtime) {
      safely("vehicle:location broadcast", () =>
        realtime.publishVehicleLocation(
          toVehicleLocationPayload(result.location),
        ),
      );
    }
  }

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    message: result.duplicate
      ? "Location was already recorded"
      : "Location recorded successfully",
    data: result.location,
  });
};

export const latest: RequestHandler = async (req, res) => {
  const { vehicleIds } = parseLatestLocationQuery(
    req.query as Record<string, unknown>,
  );
  const locations = await getLatestLocations(getEntityManager(req), vehicleIds);

  res.json({
    success: true,
    message: "Latest locations retrieved successfully",
    data: locations,
  });
};

// POST variant of `latest` for long ID lists: a GET query string with more than about
// 430 UUIDs exceeds Node's 16 KB header limit and is rejected (HTTP 431) before Express.
export const latestByIds: RequestHandler = async (req, res) => {
  const { vehicleIds } = parseLatestLocationBody(req.body);
  const locations = await getLatestLocations(getEntityManager(req), vehicleIds);

  res.json({
    success: true,
    message: "Latest locations retrieved successfully",
    data: locations,
  });
};
