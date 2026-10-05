// Health check routes.
import { Router } from "express";
import { getHealth } from "./health.controller.js";

export const healthRoutes = Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Check that the backend is running
 *     responses:
 *       200:
 *         description: The backend is running.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 * /health:
 *   get:
 *     tags: [Health]
 *     deprecated: true
 *     summary: Compatibility alias for the versioned health check
 *     responses:
 *       200:
 *         description: The backend is running.
 */
healthRoutes.get("/", getHealth);
