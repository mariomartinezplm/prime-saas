import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingState from '@/components/shared/LoadingState';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      // `dark`: esta pantalla aparece antes de que la app active su tema oscuro
      <div className="dark flex min-h-screen items-center justify-center bg-[#181619]">
        <LoadingState label="Abriendo tu sesión…" className="py-0" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
