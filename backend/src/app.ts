// Express application setup (middleware, routes, error handling).
import cors from "cors";
import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import { corsOptions } from "./config/cors.js";
import { openApiSpec } from "./config/swagger.js";
import { routes } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json());
  app.get("/api-docs.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(routes);

  return app;
}
