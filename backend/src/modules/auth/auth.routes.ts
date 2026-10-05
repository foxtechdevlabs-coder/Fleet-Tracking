// Admin authentication routes.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { getCurrentAdmin, login, logout } from "./auth.controller.js";

export const adminAuthRoutes = Router();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Sign in as an administrator
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Bearer token and administrator profile.
 *       400:
 *         description: Invalid request.
 *       401:
 *         description: Invalid credentials.
 */
adminAuthRoutes.post("/login", login);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Revoke the current bearer token
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204:
 *         description: Token revoked.
 *       401:
 *         description: Missing or invalid bearer token.
 */
adminAuthRoutes.post("/logout", requireAdmin, logout);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Return the current administrator profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Authenticated administrator.
 *       401:
 *         description: Missing or invalid bearer token.
 */
adminAuthRoutes.get("/me", requireAdmin, getCurrentAdmin);
