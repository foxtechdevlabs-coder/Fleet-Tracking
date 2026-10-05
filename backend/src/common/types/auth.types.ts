// Authenticated administrator identity attached by bearer-token middleware.
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin";
  tokenId: string;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}
