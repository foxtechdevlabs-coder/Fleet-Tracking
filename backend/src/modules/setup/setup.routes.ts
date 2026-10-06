// Authenticated vehicle/device setup route.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { createVehicleAndDevice } from "./setup.controller.js";

export const setupRoutes = Router();

/**
 * @openapi
 * /api/v1/setup/vehicle-device:
 *   post:
 *     tags: [Setup]
 *     summary: Create a vehicle and assign a new device in one transaction
 *     description: Both records are committed together or rolled back together. The device is created as assigned to the new vehicle.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicle, device]
 *             properties:
 *               vehicle:
 *                 type: object
 *                 required: [plateNumber, make, model, year]
 *                 properties:
 *                   plateNumber: { type: string, minLength: 1, maxLength: 20 }
 *                   make: { type: string, minLength: 1, maxLength: 100 }
 *                   model: { type: string, minLength: 1, maxLength: 100 }
 *                   year: { type: integer, minimum: 1900, maximum: 2100 }
 *                   status: { type: string, enum: [active, inactive, maintenance] }
 *               device:
 *                 type: object
 *                 required: [identifier]
 *                 properties:
 *                   identifier: { type: string, minLength: 1, maxLength: 100 }
 *                   status: { type: string, enum: [active, inactive], default: active }
 *     responses:
 *       201:
 *         description: Vehicle and assigned device created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Vehicle and device created successfully }
 *                 data: { type: object }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
setupRoutes.post("/vehicle-device", requireAdmin, createVehicleAndDevice);
