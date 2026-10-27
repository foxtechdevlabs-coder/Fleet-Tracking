// Authenticated normalized location ingestion route.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { ingest, latest, latestByIds } from "./tracking.controller.js";

export const trackingRoutes = Router();

/**
 * @openapi
 * /api/v1/tracking/ingest:
 *   post:
 *     tags: [Tracking]
 *     summary: Store a normalized device location
 *     description: Requires an administrator bearer token. recordedAt may be at most GPS_MAX_CLOCK_SKEW_SECONDS (default 300) ahead of the server clock, otherwise 400; delayed and out-of-order (older) readings are accepted and stored. The registered Device is found by deviceIdentifier, and vehicleId is resolved from its stored association. Repeated submissions for the same Device and recordedAt timestamp return the original record without refreshing the latest position. Clients cannot provide Device or Vehicle database IDs.
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
 *               speed: { type: number, minimum: 0, nullable: true, description: Omitted or null means not reported. }
 *               heading: { type: number, minimum: 0, maximum: 360, nullable: true, description: Omitted or null means not reported. }
 *               altitude: { type: number, nullable: true, description: Omitted or null means not reported. }
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
 *         description: Location history stored. The Vehicle's latest position is updated only when this reading has a newer recordedAt timestamp.
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

/**
 * @openapi
 * /api/v1/tracking/latest:
 *   get:
 *     tags: [Tracking]
 *     summary: Current live position of each vehicle
 *     description: >-
 *       Returns the stored live position (latest recordedAt) per vehicle. Use it for the
 *       map's initial load and after a realtime (Socket.IO) reconnect to catch up on
 *       missed vehicle:location events. Vehicles without a position, and unknown
 *       vehicle IDs, are omitted. Kept for compatibility: a query string longer than
 *       about 430 UUIDs exceeds the server's 16 KB request-header limit and is rejected
 *       with HTTP 431 (not a JSON error); use POST /api/v1/tracking/latest for long lists.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: vehicleIds
 *         required: false
 *         description: Comma-separated vehicle UUIDs (1-500 unique, in practice at most about 430 because of the URL size limit). Omit for all vehicles.
 *         schema: { type: string }
 *         example: 22222222-2222-4222-8222-222222222222,33333333-3333-4333-8333-333333333333
 *     responses:
 *       200:
 *         description: Latest positions, ordered by vehicleId.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [vehicleId, latitude, longitude, speed, heading, recordedAt, updatedAt]
 *                     properties:
 *                       vehicleId: { type: string, format: uuid }
 *                       latitude: { type: number }
 *                       longitude: { type: number }
 *                       speed: { type: number, nullable: true }
 *                       heading: { type: number, nullable: true }
 *                       recordedAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
trackingRoutes.get("/latest", latest);

/**
 * @openapi
 * /api/v1/tracking/latest:
 *   post:
 *     tags: [Tracking]
 *     summary: Current live position of the given vehicles (up to 500)
 *     description: >-
 *       Same result as GET /api/v1/tracking/latest, with the vehicle IDs in the JSON body so
 *       that up to 500 vehicles can be requested (the GET query string is limited by URL
 *       size). IDs are trimmed and lowercased; duplicates are removed before the 1-500
 *       limit is applied (at most 1000 raw entries). Unknown vehicle IDs and vehicles
 *       without a position are omitted. Read-only.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleIds]
 *             additionalProperties: false
 *             properties:
 *               vehicleIds:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1000
 *                 description: 1-500 unique vehicle UUIDs.
 *                 items: { type: string, format: uuid }
 *           example:
 *             vehicleIds: [22222222-2222-4222-8222-222222222222, 33333333-3333-4333-8333-333333333333]
 *     responses:
 *       200:
 *         description: Latest positions of the requested vehicles that have one, ordered by vehicleId.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [vehicleId, latitude, longitude, speed, heading, recordedAt, updatedAt]
 *                     properties:
 *                       vehicleId: { type: string, format: uuid }
 *                       latitude: { type: number }
 *                       longitude: { type: number }
 *                       speed: { type: number, nullable: true }
 *                       heading: { type: number, nullable: true }
 *                       recordedAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
trackingRoutes.post("/latest", latestByIds);
