// Health check routes.
import { Router } from "express";
import { getHealth } from "./health.controller.js";

export const healthRoutes = Router();

/**
 * @openapi
 * /health:
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
 */
healthRoutes.get("/", getHealth);
