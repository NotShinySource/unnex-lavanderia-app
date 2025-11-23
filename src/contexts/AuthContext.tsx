import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Tipos
interface UserData {
  id?: string;
  correo: string;
  rol: 'administrador' | 'operario' | 'repartidor' | 'cliente';
  uid: string;
  telefono?: string;
  nombre: string;
  fecha_creacion?: Date;
  ultimo_acceso?: Date;
  activo?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loginWithToken: (uid: string) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Clave para sessionStorage (se borra al cerrar navegador)
const SESSION_KEY = 'lavanderia_session_temp';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // 1. CAMBIO: Usamos sessionStorage en lugar de localStorage
  // Esto evita que el usuario se quede guardado "para siempre" si no hay "Remember me"
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!userData);

  // Función auxiliar para guardar sesión temporal
  const saveSession = (data: UserData) => {
    setUserData(data);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  };

  const clearSession = () => {
    setUserData(null);
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // LOGIN CON TOKEN (INTRA)
  const loginWithToken = async (uid: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // 2. IMPORTANTE: Forzar logout de Firebase para evitar conflictos de permisos
      // si veníamos de otra sesión.
      await signOut(auth); 
      
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      
      if (userDoc.exists()) {
        const docData = userDoc.data();
        
        const data: UserData = {
          id: uid,
          uid: uid,
          correo: docData.correo || 'usuario@intranet.cl',
          nombre: docData.nombre || 'Usuario Intranet',
          rol: docData.rol || 'operario',
          telefono: docData.telefono || undefined,
          fecha_creacion: docData.fecha_creacion?.toDate?.(),
          ultimo_acceso: docData.ultimo_acceso?.toDate?.(),
          activo: docData.activo !== undefined ? docData.activo : true
        };

        // Simulamos el usuario de Auth para que el resto de la app no falle
        const fakeUser = {
          uid: uid,
          email: data.correo,
          displayName: data.nombre,
          emailVerified: true,
        } as unknown as User;

        setCurrentUser(fakeUser);
        saveSession(data); // Guardamos en session
        return true;
      } else {
        console.error('Usuario no encontrado en Firestore');
        return false;
      }
    } catch (error) {
      console.error('Error en loginWithToken:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El onAuthStateChanged se encargará de cargar los datos
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      clearSession();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Si ya tenemos datos cargados por token (y coinciden), no recargamos
        if (userData && userData.uid === user.uid) {
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
          if (userDoc.exists()) {
            const docData = userDoc.data();
            const newData: UserData = {
              id: user.uid,
              uid: user.uid,
              correo: docData.correo || user.email || '',
              nombre: docData.nombre || user.displayName || 'Usuario',
              rol: docData.rol || 'operario',
              telefono: docData.telefono || undefined,
              activo: docData.activo ?? true
            };
            saveSession(newData);
          }
        } catch (error) {
          console.error("Error cargando datos de usuario", error);
        }
      } else {
        // Si no hay usuario de Firebase Y no estamos en medio de un proceso manual
        if (!loading) {
          // No borramos inmediatamente si userData existe para evitar parpadeos 
          // en recargas manuales, pero si auth es null real, limpiamos.
          // Para este caso simple, sincronizamos:
          // setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    login,
    logout,
    loginWithToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};