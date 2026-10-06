// Protected GPS device API routes.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import {
  create,
  getById,
  list,
  remove,
  replace,
  update,
} from "./device.controller.js";

export const deviceRoutes = Router();

/**
 * @openapi
 * /api/devices:
 *   get:
 *     tags: [Devices]
 *     summary: List devices
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
 *         description: Paginated device list.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeviceListResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   post:
 *     tags: [Devices]
 *     summary: Register a GPS device
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier]
 *             additionalProperties: false
 *             properties:
 *               identifier: { type: string, minLength: 1, maxLength: 100 }
 *               vehicleId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, enum: [active, inactive, unassigned] }
 *     responses:
 *       201:
 *         description: Device created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeviceResponse' }
 *             example:
 *               success: true
 *               message: Device created successfully
 *               data: {}
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { $ref: '#/components/responses/DeviceConflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
deviceRoutes.use(requireAdmin);
deviceRoutes.get("/", list);
deviceRoutes.post("/", create);

/**
 * @openapi
 * /api/devices/{id}:
 *   get:
 *     tags: [Devices]
 *     summary: Get a device
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Device details.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeviceResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/DeviceNotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   put:
 *     tags: [Devices]
 *     summary: Update a device's approved master-data fields
 *     description: lastSeenAt and location/telemetry history are read-only and are not modified by this operation.
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
 *             required: [identifier]
 *             additionalProperties: false
 *             properties:
 *               identifier: { type: string, minLength: 1, maxLength: 100 }
 *               vehicleId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, enum: [active, inactive, unassigned] }
 *     responses:
 *       200:
 *         description: Device updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeviceResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/DeviceNotFound' }
 *       409: { $ref: '#/components/responses/DeviceConflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   patch:
 *     tags: [Devices]
 *     summary: Update a device or its vehicle assignment
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
 *       200: { description: Device updated. }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/DeviceNotFound' }
 *       409: { $ref: '#/components/responses/DeviceConflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   delete:
 *     tags: [Devices]
 *     summary: Delete a device
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Device deleted. }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/DeviceNotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
deviceRoutes.get("/:id", getById);
deviceRoutes.put("/:id", replace);
deviceRoutes.patch("/:id", update);
deviceRoutes.delete("/:id", remove);
