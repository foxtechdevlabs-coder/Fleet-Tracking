// Protected vehicle API routes.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import {
  create,
  getById,
  list,
  remove,
  replace,
  update,
} from "./vehicle.controller.js";

export const vehicleRoutes = Router();

/**
 * @openapi
 * /api/vehicles:
 *   get:
 *     tags: [Vehicles]
 *     summary: List vehicles
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
 *     responses:
 *       200:
 *         description: Paginated vehicle list.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleListResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   post:
 *     tags: [Vehicles]
 *     summary: Register a vehicle
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plateNumber, make, model, year]
 *             additionalProperties: false
 *             properties:
 *               plateNumber: { type: string, maxLength: 20 }
 *               make: { type: string, maxLength: 100 }
 *               model: { type: string, maxLength: 100 }
 *               year: { type: integer, minimum: 1900, maximum: 2100 }
 *               status: { type: string, enum: [active, inactive, maintenance] }
 *     responses:
 *       201:
 *         description: Vehicle created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *             example:
 *               success: true
 *               message: Vehicle created successfully
 *               data: {}
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
vehicleRoutes.use(requireAdmin);
vehicleRoutes.get("/", list);
vehicleRoutes.post("/", create);

/**
 * @openapi
 * /api/vehicles/{id}:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get a vehicle
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Vehicle details.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   put:
 *     tags: [Vehicles]
 *     summary: Replace a vehicle
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plateNumber, make, model, year]
 *             additionalProperties: false
 *             properties:
 *               plateNumber: { type: string, minLength: 1, maxLength: 20 }
 *               make: { type: string, minLength: 1, maxLength: 100 }
 *               model: { type: string, minLength: 1, maxLength: 100 }
 *               year: { type: integer, minimum: 1900, maximum: 2100 }
 *               status: { type: string, enum: [active, inactive, maintenance] }
 *     responses:
 *       200:
 *         description: Vehicle replaced.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   patch:
 *     deprecated: true
 *     tags: [Vehicles]
 *     summary: Partially update a vehicle (compatibility endpoint)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Vehicle updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/VehicleResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   delete:
 *     tags: [Vehicles]
 *     summary: Delete a vehicle
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Vehicle deleted. }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
vehicleRoutes.get("/:id", getById);
vehicleRoutes.put("/:id", replace);
vehicleRoutes.patch("/:id", update);
vehicleRoutes.delete("/:id", remove);
