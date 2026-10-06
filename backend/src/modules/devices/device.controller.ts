// Device HTTP controllers.

import { UniqueConstraintViolationException } from "@mikro-orm/core";
import type { RequestHandler } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import {
  parseDeviceCreate,
  parseDeviceUpdate,
  parseDeviceUuid,
} from "./device.schema.js";
import * as service from "./device.service.js";

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
      "DEVICE_IDENTIFIER_EXISTS",
      "Device identifier already exists",
    );
  }
  throw error;
}

export const list: RequestHandler = async (req, res) => {
  const { page, limit, offset } = pagination(req);
  const [devices, total] = await service.listDevices(
    getEntityManager(req),
    limit,
    offset,
  );
  res.json({
    success: true,
    message: "Devices retrieved successfully",
    data: devices,
    meta: { page, limit, total },
  });
};

export const getById: RequestHandler = async (req, res) => {
  const device = await service.getDevice(
    getEntityManager(req),
    parseDeviceUuid(req.params.id, "id"),
  );
  res.json({
    success: true,
    message: "Device retrieved successfully",
    data: device,
  });
};

export const create: RequestHandler = async (req, res) => {
  try {
    const device = await service.createDevice(
      getEntityManager(req),
      parseDeviceCreate(req.body),
    );
    res.status(201).json({
      success: true,
      message: "Device created successfully",
      data: device,
    });
  } catch (error) {
    conflict(error);
  }
};

export const update: RequestHandler = async (req, res) => {
  try {
    const device = await service.updateDevice(
      getEntityManager(req),
      parseDeviceUuid(req.params.id, "id"),
      parseDeviceUpdate(req.body),
    );
    res.json({
      success: true,
      message: "Device updated successfully",
      data: device,
    });
  } catch (error) {
    conflict(error);
  }
};

export const replace: RequestHandler = async (req, res) => {
  try {
    const device = await service.updateDevice(
      getEntityManager(req),
      parseDeviceUuid(req.params.id, "id"),
      parseDeviceCreate(req.body),
    );
    res.json({
      success: true,
      message: "Device updated successfully",
      data: device,
    });
  } catch (error) {
    conflict(error);
  }
};

export const remove: RequestHandler = async (req, res) => {
  await service.deleteDevice(
    getEntityManager(req),
    parseDeviceUuid(req.params.id, "id"),
  );
  res.status(204).end();
};
