// Global Express error handler.
import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
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
      code: "INVALID_JSON",
    });
    return;
  }

  console.error(
    "Unhandled API error:",
    error instanceof Error ? error.name : "UnknownError",
  );
  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred",
    code: "INTERNAL_SERVER_ERROR",
  });
};
