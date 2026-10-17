// Validate bearer tokens and load the currently active administrator.
import type { RequestHandler } from "express";
import { authenticateAccessToken } from "../../modules/auth/auth.service.js";
import { AppError } from "../errors/app-error.js";
import { getEntityManager } from "./entity-manager.js";

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const admin = await authenticateAccessToken(
    () => getEntityManager(req),
    match[1],
  );
  if (!admin) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  req.admin = admin;
  next();
};
