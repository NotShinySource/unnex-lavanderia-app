import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('administrador' | 'empleado' | 'repartidor')[];
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { currentUser, userData } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && userData && !allowedRoles.includes(userData.rol)) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};