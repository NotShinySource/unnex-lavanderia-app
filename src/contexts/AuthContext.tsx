import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  //setPersistence,
  //browserSessionPersistence,
  type User 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Tipos
interface UserData {
  id?: string;
  correo: string;
  rol: 'administrador' | 'operario' | 'repartidor';
  uid: string;
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
  loading: boolean;
}

// Crear contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook personalizado
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

// Provider
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Función de login mejorada con manejo de errores
  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      try {
        const userDoc = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
        
        if (userDoc.exists()) {
          const docData = userDoc.data();
          const data: UserData = {
            id: userCredential.user.uid,
            uid: docData.uid || userCredential.user.uid,
            correo: docData.correo || userCredential.user.email || '',
            nombre: docData.nombre || userCredential.user.displayName || 'Usuario',
            rol: docData.rol || 'operario',
            fecha_creacion: docData.fecha_creacion?.toDate?.(),
            ultimo_acceso: docData.ultimo_acceso?.toDate?.(),
            activo: docData.activo !== undefined ? docData.activo : true
          };
          setUserData(data);
        } else {
          // Usuario autenticado pero sin documento en Firestore
          // Usar datos de Firebase Auth
          const data: UserData = {
            id: userCredential.user.uid,
            uid: userCredential.user.uid,
            correo: userCredential.user.email || '',
            nombre: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'Usuario',
            rol: 'operario', // Rol por defecto
            activo: true
          };
          setUserData(data);
          console.warn('⚠️ Usuario sin documento en Firestore. Usando datos de Firebase Auth.');
        }
      } catch (firestoreError) {
        // Error al acceder a Firestore (permisos, red, etc.)
        // No fallar el login, usar datos de Firebase Auth
        console.warn('⚠️ Error al acceder a Firestore:', firestoreError);
        const data: UserData = {
          id: userCredential.user.uid,
          uid: userCredential.user.uid,
          correo: userCredential.user.email || '',
          nombre: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'Usuario',
          rol: 'operario', // Rol por defecto
          activo: true
        };
        setUserData(data);
      }
      
    } catch (error: any) {
      // Mensajes de error en español
      const errorMessages: Record<string, string> = {
        'auth/user-not-found': 'Usuario no encontrado',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/invalid-email': 'Email inválido',
        'auth/user-disabled': 'Usuario deshabilitado',
        'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
        'auth/invalid-credential': 'Credenciales inválidas',
      };
      
      throw new Error(errorMessages[error.code] || 'Error al iniciar sesión');
    }
  };

  // Función de logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      
      // Resetear persistencia a sessionPersistence por defecto
      //await setPersistence(auth, browserSessionPersistence);
      
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  // Efecto para escuchar cambios de autenticación
  // En el useEffect, reemplazar TODO el código por esto:
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
    
      setCurrentUser(user);
      
      if (user) {
        
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
          
          if (userDoc.exists()) {
            const docData = userDoc.data();
            const finalUserData = {
              id: user.uid,
              uid: docData.uid || user.uid,
              correo: docData.correo || user.email || '',
              nombre: docData.nombre || user.displayName || 'Usuario',
              rol: docData.rol || 'operario',
              fecha_creacion: docData.fecha_creacion?.toDate?.(),
              ultimo_acceso: docData.ultimo_acceso?.toDate?.(),
              activo: docData.activo !== undefined ? docData.activo : true
            };
            setUserData(finalUserData);
          } else {
            const fallbackUserData = {
              id: user.uid,
              uid: user.uid,
              correo: user.email || '',
              nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
              rol: 'operario' as const,
              activo: true
            };
            setUserData(fallbackUserData);
          }
        } catch (error) {
          const fallbackUserData = {
            id: user.uid,
            uid: user.uid,
            correo: user.email || '',
            nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
            rol: 'operario' as const,
            activo: true
          };
          setUserData(fallbackUserData);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};