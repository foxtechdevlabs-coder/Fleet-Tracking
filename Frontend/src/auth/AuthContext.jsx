import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getCurrentAdmin, revokeSession, signIn } from "../services/authApi";

const sessionStorageKey = "fleettrack.auth-session";
const AuthContext = createContext(null);

function readSession() {
  const serializedSession = window.sessionStorage.getItem(sessionStorageKey);
  if (!serializedSession) return null;

  let session;
  try {
    session = JSON.parse(serializedSession);
  } catch {
    window.sessionStorage.removeItem(sessionStorageKey);
    return null;
  }

  if (
    typeof session?.accessToken !== "string" ||
    !session.accessToken ||
    session.tokenType !== "Bearer" ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= Date.now() ||
    typeof session.admin?.email !== "string" ||
    !session.admin.email ||
    typeof session.admin?.name !== "string" ||
    !session.admin.name.trim() ||
    typeof session.admin?.role !== "string" ||
    !session.admin.role
  ) {
    window.sessionStorage.removeItem(sessionStorageKey);
    return null;
  }

  return session;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [isInitializing, setIsInitializing] = useState(() =>
    Boolean(window.sessionStorage.getItem(sessionStorageKey))
  );
  const [authError, setAuthError] = useState("");
  const sessionCheckRef = useRef(null);

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
      .catch((error) => {
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

  const value = useMemo(() => ({
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
