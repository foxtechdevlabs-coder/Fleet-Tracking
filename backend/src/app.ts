// Express application setup (middleware, routes, error handling).
import cors from "cors";
import express, { type Express } from "express";
import { corsOptions } from "./config/cors.js";
import { routes } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(routes);

  return app;
}
