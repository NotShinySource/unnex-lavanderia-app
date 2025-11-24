import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loader from './Loader';

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('administrador' | 'operario' | 'repartidor' | 'cliente')[];
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { currentUser, userData, loading } = useAuth();
  
  if (loading) {
    return <Loader fullScreen text="Verificando permisos..." />;
  }

  // Si no hay usuario autenticado, redirigir a login
  if (!currentUser || !userData) {
    return <Navigate to="/login" replace />;
  }

  // Si hay roles permitidos, verificar que el usuario tenga uno de ellos
  if (allowedRoles && !allowedRoles.includes(userData.rol)) {
    switch (userData.rol) {
      case 'administrador':
        return <Navigate to="/admin" replace />;
      case 'operario':
        return <Navigate to="/operario" replace />;
      case 'repartidor':
        return <Navigate to="/repartidor" replace />;
      case 'cliente':
        return <Navigate to="/cliente" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }
  return <>{children}</>;
};