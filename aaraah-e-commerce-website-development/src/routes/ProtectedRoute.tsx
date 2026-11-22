import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/States";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { user, loading, isAdmin, mfaRequired } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking permissions…" />;
  // Admin pages have their own sign-in page (inside /admin), so the phone app never leaves its own area.
  // With 2-step login on, the admin must also enter the app code (done on the admin login page).
  if (!user || !isAdmin || mfaRequired) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}
