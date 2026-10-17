// Report HTTP controllers.
import type { RequestHandler } from "express";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import { parseLocationReportFilters } from "./report.schema.js";
import * as service from "./report.service.js";

export const locations: RequestHandler = async (req, res) => {
  const filters = parseLocationReportFilters(
    req.query as Record<string, unknown>,
  );
  const report = await service.getLocationReport(
    getEntityManager(req),
    filters,
  );
  res.json({
    success: true,
    message: "Location report retrieved successfully",
    data: report,
  });
};
