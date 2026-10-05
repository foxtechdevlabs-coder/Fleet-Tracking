// Admin authentication controllers.
import type { RequestHandler } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { getEntityManager } from "../../common/middleware/entity-manager.js";
import { parseLoginInput } from "./auth.schema.js";
import { authenticateAdmin, createAccessToken } from "./auth.service.js";
import { RevokedToken } from "./revoked-token.entity.js";

export const login: RequestHandler = async (req, res) => {
  const { email, password } = parseLoginInput(req.body);
  const em = getEntityManager(req);
  const admin = await authenticateAdmin(em, email, password);

  if (!admin) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  }

  const access = createAccessToken(admin);
  await em.nativeDelete(RevokedToken, { expiresAt: { $lte: new Date() } });

  res.status(200).json({
    data: {
      accessToken: access.token,
      tokenType: "Bearer",
      expiresIn: 3600,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    },
  });
};

export const logout: RequestHandler = async (req, res) => {
  if (!req.admin) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  const em = getEntityManager(req);
  await em.insert(RevokedToken, {
    id: req.admin.tokenId,
    expiresAt: req.admin.expiresAt,
    revokedAt: new Date(),
  });
  res.status(204).end();
};

export const getCurrentAdmin: RequestHandler = (req, res) => {
  if (!req.admin) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  }

  const { id, email, name, role } = req.admin;
  res.json({ data: { id, email, name, role } });
};
