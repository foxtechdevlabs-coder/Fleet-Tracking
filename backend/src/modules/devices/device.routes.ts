// Protected GPS device API routes.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { create, getById, list, remove, update } from "./device.controller.js";

export const deviceRoutes = Router();

/**
 * @openapi
 * /api/v1/devices:
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
 *       200: { description: Paginated device list. }
 *       401: { description: Authentication required. }
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
 *             properties:
 *               identifier: { type: string, maxLength: 100 }
 *               vehicleId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, enum: [active, inactive, unassigned] }
 *     responses:
 *       201: { description: Device created. }
 *       401: { description: Authentication required. }
 */
deviceRoutes.use(requireAdmin);
deviceRoutes.get("/", list);
deviceRoutes.post("/", create);

/**
 * @openapi
 * /api/v1/devices/{id}:
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
 *       200: { description: Device details. }
 *       404: { description: Device not found. }
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
 */
deviceRoutes.get("/:id", getById);
deviceRoutes.patch("/:id", update);
deviceRoutes.delete("/:id", remove);
