import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoLavanderia from '../assets/logo.png';

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('administrador' | 'operario' | 'repartidor')[];
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { currentUser, userData, loading } = useAuth();
  // Mostrar loading mientras se obtienen los datos
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-spac-light">
        <div className="text-center">
          <img 
            src={logoLavanderia} 
            alt="Logo Lavandería El Cobre" 
            className="inline-flex items-center justify-center w-20 h-20 bg-spac-light rounded-full mb-4"
          />
          <p className="text-spac-gray">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, redirigir a login
  if (!currentUser || !userData) {
    return <Navigate to="/login" replace />;
  }

  // Si hay roles permitidos, verificar que el usuario tenga uno de ellos
  if (allowedRoles && !allowedRoles.includes(userData.rol)) {
    // Redirigir al dashboard correcto según su rol
    switch (userData.rol) {
      case 'administrador':
        return <Navigate to="/admin" replace />;
      case 'operario':
        return <Navigate to="/operario" replace />;
      case 'repartidor':
        return <Navigate to="/repartidor" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }
  return <>{children}</>;
};