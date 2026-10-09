// Validate bearer tokens and load the currently active administrator.
import type { RequestHandler } from "express";
import { Admin } from "../../modules/admins/admin.entity.js";
import { verifyAccessToken } from "../../modules/auth/auth.service.js";
import { RevokedToken } from "../../modules/auth/revoked-token.entity.js";
import { AppError } from "../errors/app-error.js";
import { getEntityManager } from "./entity-manager.js";

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const claims = verifyAccessToken(match[1]);
  if (!claims) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const em = getEntityManager(req);
  const [admin, revoked] = await Promise.all([
    em.findOne(Admin, { id: claims.sub }),
    em.findOne(RevokedToken, { id: claims.jti }),
  ]);

  if (!admin?.isActive || revoked) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  req.admin = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    tokenId: claims.jti,
    expiresAt: new Date(claims.exp * 1000),
  };
  next();
};
