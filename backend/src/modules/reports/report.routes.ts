// Protected location report routes.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { locations } from "./report.controller.js";

export const reportRoutes = Router();

/**
 * @openapi
 * /api/v1/reports/locations:
 *   get:
 *     tags: [Reports]
 *     summary: Generate a location report
 *     description: Filters stored location history by inclusive recordedAt bounds and optional Vehicle and registered Device identifier. Supplied filters use AND logic. Both date bounds are optional.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Inclusive start timestamp; ISO 8601 with timezone.
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: Inclusive end timestamp; ISO 8601 with timezone.
 *       - in: query
 *         name: vehicleId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: deviceIdentifier
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Stored location records matching all supplied filters.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LocationReportResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/TrackingResourceNotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
reportRoutes.use(requireAdmin);
reportRoutes.get("/locations", locations);
