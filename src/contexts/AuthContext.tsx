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
  esToken?: boolean; // Flag para saber si es login por token
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithToken: (uid: string) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Clave para sessionStorage
const SESSION_KEY = 'lavanderia_session_temp';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Inicializar estado leyendo sessionStorage
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  // Simulamos un currentUser si tenemos userData guardado
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (userData) {
      return { email: userData.correo, uid: userData.uid } as User;
    }
    return null;
  });

  const [loading, setLoading] = useState(!userData);

  const saveSession = (data: UserData) => {
    setUserData(data);
    // Simulamos objeto User de firebase para compatibilidad
    setCurrentUser({ email: data.correo, uid: data.uid } as User);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  };

  const clearSession = () => {
    setUserData(null);
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // LOGIN CON TOKEN (INTRANET)
  const loginWithToken = async (uid: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // 1. Limpieza total antes de procesar nuevo token
      await signOut(auth); 
      clearSession();
      
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
          activo: docData.activo !== undefined ? docData.activo : true,
          esToken: true
        };

        saveSession(data);
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

  // LOGIN NORMAL (EMAIL/PASS)
  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
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

  // LISTENER DE FIREBASE AUTH
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Si detectamos usuario de Firebase (Login normal)
      if (user) {
        // Evitamos recargar si ya tenemos los datos correctos
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
              activo: docData.activo ?? true,
              esToken: false
            };
            saveSession(newData);
          }
        } catch (error) {
          console.error("Error cargando datos de usuario", error);
        }
      } else {
        // Si Firebase dice "no hay usuario", SOLO limpiamos si NO estamos en modo Token
        // Esto evita que firebase sobrescriba la sesión manual de la intranet
        if (userData && !userData.esToken) {
          clearSession();
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Array vacío intencional

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