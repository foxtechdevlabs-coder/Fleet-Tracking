// Authenticated normalized location ingestion route.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { ingest } from "./tracking.controller.js";

export const trackingRoutes = Router();

/**
 * @openapi
 * /api/v1/tracking/ingest:
 *   post:
 *     tags: [Tracking]
 *     summary: Store a normalized device location
 *     description: Requires an administrator bearer token. The registered Device is found by deviceIdentifier, and vehicleId is resolved from its stored association. Repeated submissions for the same Device and recordedAt timestamp return the original record without refreshing the latest position. Clients cannot provide Device or Vehicle database IDs.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceIdentifier, recordedAt, latitude, longitude]
 *             additionalProperties: false
 *             properties:
 *               deviceIdentifier: { type: string, minLength: 1, maxLength: 100 }
 *               recordedAt: { type: string, format: date-time }
 *               latitude: { type: number, minimum: -90, maximum: 90 }
 *               longitude: { type: number, minimum: -180, maximum: 180 }
 *               speed: { type: number, minimum: 0 }
 *               heading: { type: number, minimum: 0, maximum: 360 }
 *               altitude: { type: number }
 *           example:
 *             deviceIdentifier: GPS-001
 *             recordedAt: '2026-10-07T05:20:00.000Z'
 *             latitude: 51.5072
 *             longitude: -0.1276
 *             speed: 32.5
 *             heading: 180
 *             altitude: 15
 *     responses:
 *       200:
 *         description: The Device and recordedAt timestamp were already processed; the original record is returned.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TrackingLocationResponse' }
 *       201:
 *         description: Location history stored and the resolved Vehicle's latest position refreshed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TrackingLocationResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/TrackingDeviceNotFound' }
 *       409: { $ref: '#/components/responses/TrackingAssociationConflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
trackingRoutes.use(requireAdmin);
trackingRoutes.post("/ingest", ingest);
