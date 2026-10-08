// Tracking ingestion HTTP controller.
import type { RequestHandler } from "express";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import { parseTrackingLocation } from "./tracking.schema.js";
import { ingestLocation } from "./tracking.service.js";

export const ingest: RequestHandler = async (req, res) => {
  const input = parseTrackingLocation(req.body);
  const result = await ingestLocation(getEntityManager(req), input);

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    message: result.duplicate
      ? "Location was already recorded"
      : "Location recorded successfully",
    data: result.location,
  });
};
