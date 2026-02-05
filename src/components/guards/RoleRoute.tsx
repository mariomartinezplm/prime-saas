import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RoleRouteProps {
  children: React.ReactNode;
  roles: Array<'admin' | 'professional' | 'patient'>;
}

const RoleRoute = ({ children, roles }: RoleRouteProps) => {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
