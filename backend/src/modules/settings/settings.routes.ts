// Settings routes — protected by admin authentication.
import { Router } from "express";
import { requireAdmin } from "../../common/middleware/auth.middleware.js";
import { getSettings, updateSettings } from "./settings.controller.js";

export const settingsRoutes = Router();

settingsRoutes.use(requireAdmin);

settingsRoutes.get("/", getSettings);
settingsRoutes.patch("/", updateSettings);
settingsRoutes.put("/", updateSettings);

settingsRoutes.get("/:key", getSettings);
settingsRoutes.patch("/:key", updateSettings);
settingsRoutes.put("/:key", updateSettings);
