// Resolve a request-scoped MikroORM entity manager from the application.
import type { EntityManager, MikroORM } from "@mikro-orm/postgresql";
import type { Request } from "express";
import { AppError } from "../errors/app-error.js";

export function getEntityManager(req: Request): EntityManager {
  const orm = req.app.locals.orm as MikroORM | undefined;

  if (!orm) {
    throw new AppError(
      503,
      "DATABASE_UNAVAILABLE",
      "The database service is not configured",
    );
  }

  return orm.em.fork();
}
