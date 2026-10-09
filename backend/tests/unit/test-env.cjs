process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT || "3000";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/vehicle_tracking_test";
process.env.FRONTEND_ORIGINS = "http://localhost:5173";
process.env.JWT_SECRET =
  "test-only-signing-secret-with-at-least-thirty-two-bytes";
