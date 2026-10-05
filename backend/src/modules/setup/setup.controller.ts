// Vehicle and device setup HTTP controller.
import type { RequestHandler } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import { parseVehicleDeviceSetup } from "./setup.schema.js";
import { createVehicleDeviceSetup } from "./setup.service.js";

export const createVehicleAndDevice: RequestHandler = async (req, res) => {
  const input = parseVehicleDeviceSetup(req.body);
  try {
    const result = await createVehicleDeviceSetup(getEntityManager(req), input);
    res.status(201).json({ data: result });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(
        409,
        "SETUP_CONFLICT",
        "The vehicle plate number or device identifier is already registered",
      );
    }
    throw error;
  }
};
