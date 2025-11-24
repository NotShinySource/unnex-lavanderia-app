import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PrivateRoute } from './components/PrivateRoute';
import { EmployeePanel } from './pages/EmployeePanel';
import { DealerPanel } from './pages/DealerPanel';
import { ClientTracking } from './pages/ClientTracking';
import { ClientPanel } from './pages/ClientPanel';
import { FirebaseTest } from './pages/FirebaseTest';
import { useEffect } from 'react';
import { AdminPanel } from './pages/AdminPanel';
import { inicializarListenerComandas } from './services/seguimientoService';

const DashboardRedirect = () => {
  const { userData, loginWithToken } = useAuth();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const processAuth = async () => {
      const token = searchParams.get('token') || searchParams.get('auth_token');

      if (token) {
        if (!userData || userData.uid !== token) {
          await loginWithToken(token);
        }
      }
    };

    processAuth();
  }, [searchParams, userData, loginWithToken]);


  if (userData) {
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

  const token = searchParams.get('token') || searchParams.get('auth_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return null;
};

function App() {
  useEffect(() => {
    const unsubscribe = inicializarListenerComandas();
    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/seguimiento/:codigo?" element={<ClientTracking />} />
        
        <Route path="/admin" element={
            <PrivateRoute allowedRoles={['administrador']}>
              <AdminPanel />
            </PrivateRoute>
          } 
        />
        <Route path="/operario" element={
            <PrivateRoute allowedRoles={['operario']}>
              <EmployeePanel />
            </PrivateRoute>
          } 
        />
        <Route path="/repartidor" element={
            <PrivateRoute allowedRoles={['repartidor']}>
              <DealerPanel />
            </PrivateRoute>
          } 
        />
        <Route path="/cliente" element={
            <PrivateRoute allowedRoles={['cliente']}>
              <ClientPanel />
            </PrivateRoute>
          } 
        />
        <Route path="/test" element={<FirebaseTest />} /> 
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;