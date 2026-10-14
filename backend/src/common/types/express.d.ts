// Express type extensions for authenticated admin requests.
import type { AdminTokenPayload } from "../../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}
