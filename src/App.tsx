import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PrivateRoute } from './components/PrivateRoute';
import { FirebaseTest } from './pages/FirebaseTest';
import { EmployeePanel } from './pages/EmployeePanel';
import { DealerPanel } from './pages/DealerPanel';
import { ClientTracking } from './pages/ClientTracking';
import { useEffect } from 'react';
import { inicializarListenerComandas } from './services/seguimientoService';
import logoLavanderia from './assets/logo.png';

// Componente temporal para las páginas que aún no creamos
const ComingSoon = ({ title }: { title: string }) => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="bg-white p-8 rounded-lg shadow-md text-center">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">{title}</h1>
      <p className="text-gray-600">Esta página estará disponible pronto</p>
    </div>
  </div>
);

// Componente que redirige según el rol del usuario
const DashboardRedirect = () => {
  const { userData, loading } = useAuth();

  console.log('🔄 DashboardRedirect - userData:', userData, 'loading:', loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-spac-light">
        <div className="text-center">
          <img 
            src={logoLavanderia} 
            alt="Logo Lavandería El Cobre" 
            className="inline-flex items-center justify-center w-20 h-20 bg-spac-light rounded-full mb-4"
          />
          <p className="text-spac-gray">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    console.log('❌ No hay userData, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ Redirigiendo según rol:', userData.rol);

  // Redirigir según el rol
  switch (userData.rol) {
    case 'administrador':
      return <Navigate to="/admin" replace />;
    case 'operario':
      return <Navigate to="/operario" replace />;
    case 'repartidor':
      return <Navigate to="/repartidor" replace />;
    default:
      console.error('⚠️ Rol desconocido:', userData.rol);
      return <Navigate to="/login" replace />;
  }
};

function App() {
  useEffect(() => {
    console.log('🎧 Iniciando listener de comandas...');
    const unsubscribe = inicializarListenerComandas((comanda) => {
      console.log('✅ Nueva comanda detectada:', comanda.numeroOrden);
    });

    return () => unsubscribe();
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta principal - redirige según rol */}
        <Route path="/" element={<DashboardRedirect />} />
        
        {/* Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Seguimiento para clientes (sin login) */}
        <Route 
          path="/seguimiento/:codigo?" 
          element={<ClientTracking />} 
        />
        
        {/* Panel de Administrador */}
        <Route 
          path="/admin" 
          element={
            <PrivateRoute allowedRoles={['administrador']}>
              <ComingSoon title="Panel de Administrador" />
            </PrivateRoute>
          } 
        />

        {/* Panel de operario */}
        <Route 
          path="/operario" 
          element={
            <PrivateRoute allowedRoles={['operario']}>
              <EmployeePanel />
            </PrivateRoute>
          } 
        />

        {/* Panel de Repartidor */}
        <Route 
          path="/repartidor" 
          element={
            <PrivateRoute allowedRoles={['repartidor']}>
              <DealerPanel />
            </PrivateRoute>
          } 
        />

        {/* Test de Firebase (accesible sin autenticación en desarrollo) */}
        <Route path="/test" element={<FirebaseTest />} /> 
        
        {/* Ruta 404 - redirige a home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;