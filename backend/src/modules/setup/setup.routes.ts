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
 *       201: { description: Vehicle and its assigned device were created. }
 *       400: { description: Missing, malformed, or unsupported field. }
 *       401: { description: Authentication required. }
 *       409: { description: Vehicle plate or device identifier already exists. }
 */
setupRoutes.post("/vehicle-device", requireAdmin, createVehicleAndDevice);
