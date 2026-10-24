// Vehicle HTTP controllers.

import { UniqueConstraintViolationException } from "@mikro-orm/core";
import type { RequestHandler } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import {
  parseUuid,
  parseVehicleCreate,
  parseVehicleUpdate,
} from "./vehicle.schema.js";
import * as service from "./vehicle.service.js";

function pagination(req: Parameters<RequestHandler>[0]) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 25 : Number(req.query.limit);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "page must be positive and limit must be 1-100",
    );
  }
  return { page, limit, offset: (page - 1) * limit };
}

function conflict(error: unknown): never {
  if (
    error instanceof UniqueConstraintViolationException ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505")
  ) {
    throw new AppError(
      409,
      "VEHICLE_IDENTIFIER_EXISTS",
      "Vehicle identifier already exists",
    );
  }
  throw error;
}

export const list: RequestHandler = async (req, res) => {
  const { page, limit, offset } = pagination(req);
  const [vehicles, total] = await service.listVehicles(
    getEntityManager(req),
    limit,
    offset,
  );
  res.json({
    success: true,
    message: "Vehicles retrieved successfully",
    data: vehicles,
    meta: { page, limit, total },
  });
};

export const getById: RequestHandler = async (req, res) => {
  const vehicle = await service.getVehicle(
    getEntityManager(req),
    parseUuid(req.params.id, "id"),
  );
  res.json({
    success: true,
    message: "Vehicle retrieved successfully",
    data: vehicle,
  });
};

export const create: RequestHandler = async (req, res) => {
  try {
    const vehicle = await service.createVehicle(
      getEntityManager(req),
      parseVehicleCreate(req.body),
    );
    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    conflict(error);
  }
};

export const replace: RequestHandler = async (req, res) => {
  try {
    const input = parseVehicleCreate(req.body);
    const vehicle = await service.updateVehicle(
      getEntityManager(req),
      parseUuid(req.params.id, "id"),
      { ...input, status: input.status ?? "active" },
    );
    res.json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    conflict(error);
  }
};

export const update: RequestHandler = async (req, res) => {
  try {
    const vehicle = await service.updateVehicle(
      getEntityManager(req),
      parseUuid(req.params.id, "id"),
      parseVehicleUpdate(req.body),
    );
    res.json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    conflict(error);
  }
};

export const remove: RequestHandler = async (req, res) => {
  await service.deleteVehicle(
    getEntityManager(req),
    parseUuid(req.params.id, "id"),
  );
  res.status(204).end();
};
