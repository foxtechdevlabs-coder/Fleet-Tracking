// Swagger / OpenAPI configuration.
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

// Route files are scanned for `@openapi` JSDoc blocks (.ts in dev, .js after build).
const modulesDir = fileURLToPath(new URL("../modules/", import.meta.url));

export const openApiSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Vehicle Tracking API",
      version: "0.1.0",
      description: "Vehicle Tracking System — Phase 1 backend API.",
    },
    // Relative URL: requests go to whichever host serves the docs.
    servers: [{ url: "/", description: "Current host" }],
  },
  apis: [`${modulesDir}**/*.routes.{ts,js}`],
});
