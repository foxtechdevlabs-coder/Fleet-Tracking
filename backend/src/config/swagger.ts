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
          required: ["success", "message", "data"],
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Vehicle operation successful",
            },
            data: { $ref: "#/components/schemas/Vehicle" },
          },
        },
        VehicleListResponse: {
          type: "object",
          required: ["success", "message", "data", "meta"],
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Vehicles retrieved successfully",
            },
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
        Device: {
          type: "object",
          required: [
            "id",
            "identifier",
            "vehicleId",
            "status",
            "lastSeenAt",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            identifier: { type: "string", maxLength: 100 },
            vehicleId: { type: "string", format: "uuid", nullable: true },
            status: {
              type: "string",
              enum: ["active", "inactive", "unassigned"],
            },
            lastSeenAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        DeviceResponse: {
          type: "object",
          required: ["success", "message", "data"],
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Device operation successful" },
            data: { $ref: "#/components/schemas/Device" },
          },
        },
        DeviceListResponse: {
          type: "object",
          required: ["success", "message", "data", "meta"],
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Devices retrieved successfully",
            },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Device" },
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
          example: {
            success: false,
            message: "Validation failed",
            code: "VALIDATION_ERROR",
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Invalid request data.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                success: false,
                message: "Validation failed",
                code: "VALIDATION_ERROR",
              },
            },
          },
        },
        Unauthorized: {
          description: "Missing, invalid, expired, or revoked bearer token.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                success: false,
                message: "Unauthorized",
                code: "UNAUTHORIZED",
              },
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
        DeviceNotFound: {
          description: "Device was not found.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Conflict: {
          description: "Vehicle identifier already exists.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                success: false,
                message: "Vehicle identifier already exists",
                code: "VEHICLE_IDENTIFIER_EXISTS",
              },
            },
          },
        },
        DeviceConflict: {
          description: "A device with this identifier already exists.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                success: false,
                message: "Device identifier already exists",
                code: "DEVICE_IDENTIFIER_EXISTS",
              },
            },
          },
        },
        ServerError: {
          description: "Unexpected backend or database failure.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                success: false,
                message: "Internal server error",
                code: "INTERNAL_SERVER_ERROR",
              },
            },
          },
        },
      },
    },
  },
  apis: [`${modulesDir}**/*.routes.{ts,js}`],
});
