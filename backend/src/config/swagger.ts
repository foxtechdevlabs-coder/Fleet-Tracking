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
        TrackingLocationResponse: {
          type: "object",
          required: ["success", "message", "data"],
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Location recorded successfully",
            },
            data: {
              type: "object",
              required: [
                "id",
                "deviceId",
                "vehicleId",
                "latitude",
                "longitude",
                "recordedAt",
                "ingestedAt",
              ],
              properties: {
                id: { type: "string", format: "uuid" },
                deviceId: { type: "string", format: "uuid" },
                vehicleId: { type: "string", format: "uuid" },
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
                speed: { type: "number", nullable: true },
                heading: {
                  type: "number",
                  minimum: 0,
                  maximum: 360,
                  nullable: true,
                },
                altitude: { type: "number", nullable: true },
                recordedAt: { type: "string", format: "date-time" },
                ingestedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        LocationReportResponse: {
          type: "object",
          required: ["success", "message", "data"],
          properties: {
            success: { type: "boolean", example: true },
            message: {
              type: "string",
              example: "Location report retrieved successfully",
            },
            data: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "recordedAt",
                  "vehicleId",
                  "deviceId",
                  "latitude",
                  "longitude",
                  "speed",
                  "heading",
                  "altitude",
                ],
                properties: {
                  recordedAt: { type: "string", format: "date-time" },
                  vehicleId: { type: "string", format: "uuid" },
                  deviceId: { type: "string", format: "uuid" },
                  latitude: {
                    type: "number",
                    minimum: -90,
                    maximum: 90,
                    nullable: true,
                  },
                  longitude: {
                    type: "number",
                    minimum: -180,
                    maximum: 180,
                    nullable: true,
                  },
                  speed: { type: "number", nullable: true },
                  heading: { type: "number", nullable: true },
                  altitude: { type: "number", nullable: true },
                },
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
        TrackingDeviceNotFound: {
          description: "No registered Device matches deviceIdentifier.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                success: false,
                message: "Registered device was not found",
                code: "DEVICE_NOT_FOUND",
              },
            },
          },
        },
        TrackingResourceNotFound: {
          description:
            "The requested Vehicle or registered Device was not found.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              examples: {
                vehicle: {
                  value: {
                    success: false,
                    message: "Vehicle was not found",
                    code: "VEHICLE_NOT_FOUND",
                  },
                },
                device: {
                  value: {
                    success: false,
                    message: "Registered device was not found",
                    code: "DEVICE_NOT_FOUND",
                  },
                },
              },
            },
          },
        },
        TrackingAssociationConflict: {
          description:
            "The registered device is not assigned to a valid vehicle.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              examples: {
                unassigned: {
                  value: {
                    success: false,
                    message: "Device is not assigned to a vehicle",
                    code: "DEVICE_NOT_ASSIGNED",
                  },
                },
                invalidAssociation: {
                  value: {
                    success: false,
                    message: "Device vehicle association is invalid",
                    code: "DEVICE_VEHICLE_ASSOCIATION_INVALID",
                  },
                },
              },
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
