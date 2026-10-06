// Vehicle and device setup HTTP controller.
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import type { RequestHandler } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import { parseVehicleDeviceSetup } from "./setup.schema.js";
import { createVehicleDeviceSetup } from "./setup.service.js";

export const createVehicleAndDevice: RequestHandler = async (req, res) => {
  const input = parseVehicleDeviceSetup(req.body);
  try {
    const result = await createVehicleDeviceSetup(getEntityManager(req), input);
    res.status(201).json({
      success: true,
      message: "Vehicle and device created successfully",
      data: result,
    });
  } catch (error) {
    if (
      error instanceof UniqueConstraintViolationException ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505")
    ) {
      const constraint =
        "constraint" in error && typeof error.constraint === "string"
          ? error.constraint
          : "";
      if (constraint.includes("devices_identifier")) {
        throw new AppError(
          409,
          "DEVICE_IDENTIFIER_EXISTS",
          "Device identifier already exists",
        );
      }
      if (constraint.includes("vehicles_plate_number")) {
        throw new AppError(
          409,
          "VEHICLE_IDENTIFIER_EXISTS",
          "Vehicle identifier already exists",
        );
      }
      throw new AppError(
        409,
        "SETUP_CONFLICT",
        "Vehicle or device identifier already exists",
      );
    }
    throw error;
  }
};
