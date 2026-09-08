import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RoleRouteProps {
  children: React.ReactNode;
  roles: Array<'admin' | 'professional' | 'patient'>;
}

const RoleRoute = ({ children, roles }: RoleRouteProps) => {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    // El destino depende del rol real (Paso 14 de BLUEPRINT.md): con las
    // rutas de paciente ahora también protegidas por este mismo guard, un
    // fallback fijo a /app/dashboard causaría un loop si el usuario
    // rechazado tampoco es paciente (ese mismo guard lo volvería a
    // rechazar). Cada rol cae en un solo salto a su panel correcto.
    const fallback = user?.role === 'patient' ? '/app/dashboard' : '/app/admin';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
