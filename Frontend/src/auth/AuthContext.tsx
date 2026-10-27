import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, getCurrentAdmin, readAdmin, revokeSession, signIn } from "../services/authApi";
import type { Admin, Session } from "../types/fleet";

const sessionStorageKey = "fleettrack.auth-session";

interface AuthContextValue {
  session: Session | null;
  admin: Admin | undefined;
  isAuthenticated: boolean;
  isInitializing: boolean;
  authError: string;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): Session | null {
  const serializedSession = window.sessionStorage.getItem(sessionStorageKey);
  if (!serializedSession) return null;

  let session: Partial<Session> | null;
  try {
    session = JSON.parse(serializedSession) as Partial<Session> | null;
  } catch {
    window.sessionStorage.removeItem(sessionStorageKey);
    return null;
  }

  const admin = readAdmin(session?.admin);
  if (
    typeof session?.accessToken !== "string" ||
    !session.accessToken ||
    session.tokenType !== "Bearer" ||
    typeof session.expiresAt !== "number" ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= Date.now() ||
    !admin
  ) {
    window.sessionStorage.removeItem(sessionStorageKey);
    return null;
  }

  return { accessToken: session.accessToken, tokenType: session.tokenType, expiresAt: session.expiresAt, admin };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);
  const [isInitializing, setIsInitializing] = useState(() =>
    Boolean(window.sessionStorage.getItem(sessionStorageKey))
  );
  const [authError, setAuthError] = useState("");
  const sessionCheckRef = useRef<{ accessToken: string; promise: Promise<Admin> } | null>(null);

  useEffect(() => {
    if (!session) {
      setIsInitializing(false);
      return undefined;
    }

    let isActive = true;
    let sessionCheck = sessionCheckRef.current;
    if (!sessionCheck || sessionCheck.accessToken !== session.accessToken) {
      sessionCheck = {
        accessToken: session.accessToken,
        promise: getCurrentAdmin(session)
      };
      sessionCheckRef.current = sessionCheck;
    }

    sessionCheck.promise
      .then((admin) => {
        if (!isActive) return;
        setSession((currentSession) =>
          currentSession?.accessToken === session.accessToken
            ? { ...currentSession, admin }
            : currentSession
        );
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        window.sessionStorage.removeItem(sessionStorageKey);
        setSession(null);
        setAuthError(
          error instanceof ApiError && error.status === 401
            ? "Your session has expired. Please sign in again."
            : "Your previous session could not be verified. Please sign in again."
        );
      })
      .finally(() => {
        if (isActive) setIsInitializing(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    const timeout = window.setTimeout(() => {
      window.sessionStorage.removeItem(sessionStorageKey);
      setSession(null);
      setAuthError("Your session has expired. Please sign in again.");
    }, Math.min(session.expiresAt - Date.now(), 2147483647));

    return () => window.clearTimeout(timeout);
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    admin: session?.admin,
    isAuthenticated: Boolean(session),
    isInitializing,
    authError,
    clearAuthError: () => setAuthError(""),
    login: async (email, password) => {
      const authenticatedSession = await signIn(email, password);
      window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(authenticatedSession));
      setSession(authenticatedSession);
      setAuthError("");
    },
    logout: async () => {
      const currentSession = session;
      window.sessionStorage.removeItem(sessionStorageKey);
      setSession(null);
      setAuthError("");
      if (currentSession) await revokeSession(currentSession);
    }
  }), [session, isInitializing, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/** Returns the signed-in session; only use inside routes wrapped by RequireAuth. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) {
    throw new Error("useSession must be used inside an authenticated route");
  }
  return session;
}
