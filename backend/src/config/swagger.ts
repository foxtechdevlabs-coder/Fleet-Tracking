// Swagger / OpenAPI configuration.
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

// Route files are scanned for `@openapi` JSDoc blocks (.ts in dev, .js after build).
const modulesDir = fileURLToPath(
  new URL("../modules/", import.meta.url),
).replaceAll("\\", "/");

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
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Vehicle: {
          type: "object",
          required: [
            "id",
            "plateNumber",
            "make",
            "model",
            "year",
            "status",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            plateNumber: { type: "string", maxLength: 20 },
            make: { type: "string", maxLength: 100 },
            model: { type: "string", maxLength: 100 },
            year: { type: "integer", minimum: 1900, maximum: 2100 },
            status: {
              type: "string",
              enum: ["active", "inactive", "maintenance"],
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        VehicleResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/Vehicle" },
          },
        },
        VehicleListResponse: {
          type: "object",
          required: ["success", "data", "meta"],
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Vehicle" },
            },
            meta: {
              type: "object",
              required: ["page", "limit", "total"],
              properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
              },
            },
          },
        },
        ApiError: {
          type: "object",
          required: ["success", "message", "code"],
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            code: { type: "string" },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Invalid request or vehicle ID.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Unauthorized: {
          description: "Missing, invalid, expired, or revoked bearer token.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        NotFound: {
          description: "Vehicle was not found.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Conflict: {
          description: "A vehicle with this plate number already exists.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        ServerError: {
          description: "Unexpected server error.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
    },
  },
  apis: [`${modulesDir}**/*.routes.{ts,js}`],
});
