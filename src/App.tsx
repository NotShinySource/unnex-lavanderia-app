import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PrivateRoute } from './components/PrivateRoute';
import { EmployeePanel } from './pages/EmployeePanel';
import { DealerPanel } from './pages/DealerPanel';
import { ClientTracking } from './pages/ClientTracking';
import { ClientPanel } from './pages/ClientPanel';
import { FirebaseTest } from './pages/FirebaseTest';
import { useEffect, useState } from 'react';
import { AdminPanel } from './pages/AdminPanel';
import { inicializarListenerComandas } from './services/seguimientoService';

// URL de tu Intranet
const MAIN_INTRANET_URL = "https://lavanderia-cobre-landingpage.vercel.app/intranet/dashboard";

// Componente que maneja la redirección inicial y Login por Token
const DashboardRedirect = () => {
  const { userData, loading, loginWithToken } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<'verifying' | 'error' | 'success'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    // SOLUCIÓN ERROR NODEJS: Usamos un tipo genérico
    let timeoutId: ReturnType<typeof setTimeout>;

    const verifyAccess = async () => {
      const token = searchParams.get('token') || searchParams.get('auth_token');

      // Timeout de seguridad (8 segundos)
      timeoutId = setTimeout(() => {
        if (isMounted && status === 'verifying') {
          setErrorMessage('Tiempo de espera agotado. Redirigiendo...');
          setStatus('error');
          setTimeout(() => window.location.href = MAIN_INTRANET_URL, 2000);
        }
      }, 8000);

      try {
        // CASO 1: Viene un token
        if (token) {
          // Si no hay usuario, o el usuario que hay guardado NO es el del token
          if (!userData || userData.uid !== token) {
            console.log("🔄 Token nuevo detectado, validando...");
            const success = await loginWithToken(token);
            
            if (!isMounted) return;

            if (!success) {
              setErrorMessage('Credenciales inválidas o acceso denegado.');
              setStatus('error');
              setTimeout(() => window.location.href = MAIN_INTRANET_URL, 2000);
              return;
            }
          }
        } 
        // CASO 2: No hay token, pero tampoco sesión
        else if (!userData && !loading) {
           // Dejamos pasar para que el Router redirija al Login normal
           if (isMounted) setStatus('success'); 
           return;
        }

        if (isMounted) setStatus('success');

      } catch (err) {
        console.error(err);
        if (isMounted) {
          setErrorMessage('Error de conexión.');
          setStatus('error');
          setTimeout(() => window.location.href = MAIN_INTRANET_URL, 2000);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Ejecutamos la verificación inmediatamente para manejar el caso
    // en que llega un token desde la intranet y mostrar la pantalla
    // de carga específica aunque el provider aún esté en estado loading.
    verifyAccess();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchParams, userData, loading, loginWithToken]);

  // --- PANTALLA DE CARGA (Estilo de tu amigo) ---
  if (loading || status === 'verifying' || status === 'error') {
    // Si no hay token ni usuario, no mostramos carga, dejamos caer al login
    const token = searchParams.get('token') || searchParams.get('auth_token');
    if (!token && !userData && !loading) return <Navigate to="/login" replace />;

    const ORANGE_100 = '#ffedd5';
    const ORANGE_200 = '#fed7aa'; 
    const ORANGE_500 = '#f97316'; 
    const ORANGE_600 = '#ea580c'; 
    const RED_600 = '#dc2626';

    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: `linear-gradient(to bottom right, ${ORANGE_100}, ${ORANGE_200})`,
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          {status === 'error' ? (
            <div style={{ fontSize: '3rem', color: RED_600 }}>⚠️</div>
          ) : (
            <div style={{ 
              width: '3rem', 
              height: '3rem', 
              border: `4px solid ${ORANGE_500}`, 
              borderTopColor: 'transparent', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }}></div>
          )}
          
          <div style={{ 
            fontSize: '1.25rem',
            fontWeight: '600',
            color: status === 'error' ? RED_600 : ORANGE_600 
          }}>
            {status === 'error' ? errorMessage : 'Validando credenciales...'}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!userData) {
    return <Navigate to="/login" replace />;
  }

  // Redirección según rol
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
};

function App() {

  useEffect(() => {
    console.log('🎧 Iniciando listener de comandas...');
    const unsubscribe = inicializarListenerComandas((comanda) => {
      console.log('✅ Nueva comanda detectada:', comanda.numeroOrden);
    });

    return () => {
      console.log('🔴 Deteniendo listener de comandas');
      unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/seguimiento/:codigo?" element={<ClientTracking />} />
        
        <Route path="/admin" element={
            <PrivateRoute allowedRoles={['administrador']}>
              <AdminPanel />  // ✅ AGREGAR ESTO
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