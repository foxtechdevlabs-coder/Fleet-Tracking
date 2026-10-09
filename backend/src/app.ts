// Express application setup (middleware, routes, error handling).

import type { MikroORM } from "@mikro-orm/postgresql";
import cors from "cors";
import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./common/errors/error-handler.js";
import { notFound } from "./common/middleware/not-found.middleware.js";
import { corsOptions } from "./config/cors.js";
import { openApiSpec } from "./config/swagger.js";
import { routes } from "./routes/index.js";

export function createApp(orm?: MikroORM): Express {
  const app = express();

  app.locals.orm = orm;
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api-docs.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
