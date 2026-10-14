import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { revokeSession, signIn } from "../services/authApi";

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
    typeof session.admin?.id !== "string" ||
    typeof session.admin?.email !== "string" ||
    typeof session.admin?.name !== "string" ||
    typeof session.admin?.role !== "string"
  ) {
    window.sessionStorage.removeItem(sessionStorageKey);
    return null;
  }

  return session;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    if (!session) return undefined;

    const timeout = window.setTimeout(() => {
      window.sessionStorage.removeItem(sessionStorageKey);
      setSession(null);
    }, Math.min(session.expiresAt - Date.now(), 2147483647));

    return () => window.clearTimeout(timeout);
  }, [session]);

  const value = useMemo(() => ({
    session,
    admin: session?.admin,
    isAuthenticated: Boolean(session),
    login: async (email, password) => {
      const authenticatedSession = await signIn(email, password);
      window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(authenticatedSession));
      setSession(authenticatedSession);
    },
    logout: async () => {
      const currentSession = session;
      window.sessionStorage.removeItem(sessionStorageKey);
      setSession(null);
      if (currentSession) await revokeSession(currentSession);
    }
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
