import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PrivateRoute } from './components/PrivateRoute';
import { FirebaseTest } from './pages/FirebaseTest';
import { LogoutButton } from './components/LogoutButton';
// import { ClientTracking } from './pages/ClientTracking';
import { EmployeePanel } from './pages/EmployeePanel';
// import { AdminPanel } from './pages/AdminPanel';

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

  //console.log('DashboardRedirect - userData:', userData);
  //console.log('DashboardRedirect - loading:', loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!userData) {
    //console.log('No hay userData, redirigiendo a login');
    return <Navigate to="/login" replace />;
  }

  //console.log('Redirigiendo según rol:', userData.rol);

  // Redirigir según el rol
  switch (userData.rol) {
    case 'administrador':
      return <Navigate to="/admin" replace />;
    case 'empleado':
      return <Navigate to="/empleado" replace />;
    case 'repartidor':
      return <Navigate to="/repartidor" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta principal */}
        <Route path="/" element={<DashboardRedirect />} />
        
        {/* Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Seguimiento para clientes (sin login) */}
        <Route 
          path="/seguimiento" 
          element={<ComingSoon title="Seguimiento de Pedido" />} 
        />
        
        {/* Panel de Administrador */}
        <Route 
          path="/admin" 
          element={
            <PrivateRoute allowedRoles={['administrador']}>
              <div className="min-h-screen bg-gray-100">
                <nav className="bg-white shadow-md p-4 flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-spac-dark">Panel de Administrador</h1>
                  <LogoutButton />
                </nav>
                <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                  <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Bienvenido, Administrador</h2>
                    <p className="text-gray-600">Esta página estará disponible pronto</p>
                  </div>
                </div>
              </div>
            </PrivateRoute>
          } 
        />

        {/* Panel de empleado */}
        <Route 
          path="/empleado" 
          element={
            <PrivateRoute allowedRoles={['empleado']}>
              <EmployeePanel />
            </PrivateRoute>
          } 
        />

        {/* Panel de Repartidor */}
        <Route 
          path="/repartidor" 
          element={
            <PrivateRoute allowedRoles={['repartidor']}>
              <div className="min-h-screen bg-gray-100">
                <nav className="bg-white shadow-md p-4 flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-spac-dark">Panel de Repartidor</h1>
                  <LogoutButton />
                </nav>
                <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                  <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Bienvenido, Repartidor</h2>
                    <p className="text-gray-600">Esta página estará disponible pronto</p>
                  </div>
                </div>
              </div>
            </PrivateRoute>
          } 
        />

        {/* Test de Firebase */}
        <Route path="/test" element={<FirebaseTest />} /> 
        
        {/* Ruta 404 */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;