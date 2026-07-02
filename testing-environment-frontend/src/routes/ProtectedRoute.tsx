import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import { LoadingState } from '../components/ui/LoadingState';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Checking session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
