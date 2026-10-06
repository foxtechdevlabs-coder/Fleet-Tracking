// Global Express error handler.
import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    if (error.status === 401) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }

    if (error.status === 500) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      });
      return;
    }

    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.status === 400 ? "VALIDATION_ERROR" : error.code,
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({
      success: false,
      message: "Request body must be valid JSON",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  console.error("Unhandled API error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
};
