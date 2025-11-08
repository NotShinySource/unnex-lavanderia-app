import { useState } from 'react';
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export const FirebaseTest = () => {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string, isError = false) => {
    setResults(prev => [...prev, `${isError ? '❌' : '✅'} ${message}`]);
  };

  const runTests = async () => {
    setResults([]);
    setLoading(true);

    try {
      // TEST 1: Verificar configuración de Firebase
      addResult('Verificando configuración de Firebase...');
      if (auth && db) {
        addResult('Firebase inicializado correctamente');
      } else {
        addResult('Error: Firebase no está inicializado', true);
        setLoading(false);
        return;
      }

      // TEST 2: Verificar variables de entorno
      addResult('Verificando variables de entorno...');
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      
      if (apiKey && projectId) {
        addResult(`API Key: ${apiKey.substring(0, 10)}...`);
        addResult(`Project ID: ${projectId}`);
      } else {
        addResult('Error: Variables de entorno no configuradas', true);
        setLoading(false);
        return;
      }

      // TEST 3: Intentar login
      addResult('Intentando login con admin@spac.com...');
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth, 
          'admin@spac.com', 
          'admin123'
        );
        addResult(`Usuario autenticado: ${userCredential.user.email}`);
        addResult(`UID: ${userCredential.user.uid}`);

        // TEST 4: Intentar leer documento del usuario
        addResult('Intentando leer documento de Firestore...');
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
          
          if (userDoc.exists()) {
            addResult('Documento encontrado en Firestore');
            addResult(`Datos: ${JSON.stringify(userDoc.data())}`);
          } else {
            addResult('Documento NO existe en Firestore', true);
            addResult(`Buscar documento con ID: ${userCredential.user.uid}`, true);
          }
        } catch (firestoreError: any) {
          addResult(`Error de Firestore: ${firestoreError.message}`, true);
          addResult(`Código: ${firestoreError.code}`, true);
        }

        // TEST 5: Listar documentos en usuarios
        addResult('Listando todos los documentos en "usuarios"...');
        try {
          const usuariosSnapshot = await getDocs(collection(db, 'usuarios'));
          addResult(`Total de documentos: ${usuariosSnapshot.size}`);
          usuariosSnapshot.forEach((doc) => {
            addResult(`- ID: ${doc.id}, Datos: ${JSON.stringify(doc.data())}`);
          });
        } catch (listError: any) {
          addResult(`Error al listar: ${listError.message}`, true);
        }

      } catch (authError: any) {
        addResult(`Error de autenticación: ${authError.message}`, true);
        addResult(`Código: ${authError.code}`, true);
      }

    } catch (error: any) {
      addResult(`Error general: ${error.message}`, true);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          🔍 Test de Conexión Firebase
        </h1>

        <button
          onClick={runTests}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-50 mb-6"
        >
          {loading ? 'Ejecutando tests...' : 'Ejecutar Tests'}
        </button>

        <div className="bg-gray-50 rounded-lg p-6 font-mono text-sm space-y-2 max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-gray-500">Presiona el botón para ejecutar los tests</p>
          ) : (
            results.map((result, index) => (
              <div key={index} className="whitespace-pre-wrap break-all">
                {result}
              </div>
            ))
          )}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">📋 Checklist:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Usuario creado en Firebase Authentication</li>
            <li>• Documento en Firestore con el mismo UID</li>
            <li>• Campo "rol" = "administrador" (exacto)</li>
            <li>• Archivo .env configurado correctamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
};