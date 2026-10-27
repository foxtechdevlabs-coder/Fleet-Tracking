import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoadingState } from "../Components/Feedback/AsyncState";

function RequireAuth() {
  const { isAuthenticated, isInitializing, authError } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <LoadingState message="Verifying your session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location, authError }} />;
  }

  return <Outlet />;
}

export default RequireAuth;
