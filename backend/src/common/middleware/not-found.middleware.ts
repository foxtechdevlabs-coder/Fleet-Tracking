// 404 not-found middleware.
import type { RequestHandler } from "express";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    message: "The requested resource was not found",
    code: "NOT_FOUND",
  });
};
