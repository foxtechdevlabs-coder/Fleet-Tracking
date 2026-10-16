// Express application setup (middleware, routes, error handling).

import type { MikroORM } from "@mikro-orm/postgresql";
import cors from "cors";
import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./common/errors/error-handler.js";
import { notFound } from "./common/middleware/not-found.middleware.js";
import { createRequestRateLimit } from "./common/middleware/rate-limit.middleware.js";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { openApiSpec } from "./config/swagger.js";
import { routes } from "./routes/index.js";

interface AppRateLimits {
  api: number;
  ingest: number;
}

export function createApp(
  orm?: MikroORM,
  rateLimits: AppRateLimits = {
    api: env.apiRateLimitPerMinute,
    ingest: env.ingestRateLimitPerMinute,
  },
): Express {
  const app = express();

  app.locals.orm = orm;
  app.use(cors(corsOptions));
  // After CORS (so browsers can read a 429) and before body parsing, authentication and
  // routes (so floods are rejected without parsing JSON or touching the database).
  app.use(
    "/api/v1/tracking/ingest",
    createRequestRateLimit({
      identifier: "ingest",
      limitPerMinute: rateLimits.ingest,
    }),
  );
  app.use(
    createRequestRateLimit({
      identifier: "api",
      limitPerMinute: rateLimits.api,
      // Only /api/*; health checks and GPS ingest (limited above) are excluded.
      skip: (req) =>
        !req.path.startsWith("/api/") ||
        req.path.startsWith("/api/v1/health") ||
        req.path.startsWith("/api/v1/tracking/ingest"),
    }),
  );
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
