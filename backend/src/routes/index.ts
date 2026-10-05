// Root API router (mounts module routes).
import { Router } from "express";
import { adminAuthRoutes } from "../modules/auth/auth.routes.js";
import { deviceRoutes } from "../modules/devices/device.routes.js";
import { healthRoutes } from "../modules/health/health.routes.js";
import { setupRoutes } from "../modules/setup/setup.routes.js";
import { vehicleRoutes } from "../modules/vehicles/vehicle.routes.js";

export const routes = Router();

routes.use("/health", healthRoutes);
routes.use("/api/v1/health", healthRoutes);
routes.use("/api/v1/auth", adminAuthRoutes);
routes.use("/api/v1/vehicles", vehicleRoutes);
routes.use("/api/vehicles", vehicleRoutes);
routes.use("/api/v1/devices", deviceRoutes);
routes.use("/api/v1/setup", setupRoutes);
