import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Comanda, Turno, EmpleadoAsignado } from '../types';
import { avanzarEstado } from '../services/comandaService';
import { useAuth } from '../contexts/AuthContext';

interface ModalAvanzarEstadoProps {
  comanda: Comanda;
  onClose: () => void;
  onSuccess: () => void;
}

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
}

export const ModalAvanzarEstado = ({ comanda, onClose, onSuccess }: ModalAvanzarEstadoProps) => {
  const { userData } = useAuth();
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno>('A');
  const [empleados, setEmpleados] = useState<Usuario[]>([]);
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);

  // Determinar si necesitamos asignar empleados
  // Ahora se asignan cuando avanzas DE pendiente (para el próximo estado: lavando)
  const necesitaAsignacion = comanda.estadoActual === 'pendiente' || 
    ['lavando', 'secando', 'planchando', 'desmanche'].includes(comanda.estadoActual);

  // Cargar empleados disponibles
  useEffect(() => {
    const cargarEmpleados = async () => {
      try {
        const q = query(
          collection(db, 'usuarios'),
          where('rol', '==', 'empleado'),
          where('activo', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const empleadosData: Usuario[] = [];
        
        snapshot.forEach(doc => {
          empleadosData.push({
            id: doc.id,
            nombre: doc.data().nombre,
            rol: doc.data().rol
          });
        });
        
        setEmpleados(empleadosData);
      } catch (error) {
        console.error('Error al cargar empleados:', error);
      } finally {
        setLoadingEmpleados(false);
      }
    };

    if (necesitaAsignacion) {
      cargarEmpleados();
    } else {
      setLoadingEmpleados(false);
    }
  }, [necesitaAsignacion]);

  // Toggle selección de empleado
  const toggleEmpleado = (empleadoId: string) => {
    setEmpleadosSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(empleadoId)) {
        newSet.delete(empleadoId);
      } else {
        newSet.add(empleadoId);
      }
      return newSet;
    });
  };

  // Manejar avance de estado
  const handleAvanzar = async () => {
    if (!userData) return;

    // Validar que se hayan seleccionado empleados si es necesario
    if (necesitaAsignacion && empleadosSeleccionados.size === 0) {
      alert('Debes seleccionar al menos un empleado');
      return;
    }

    try {
      setLoading(true);

      const empleadosAsignadosArray: EmpleadoAsignado[] = [];
      
      if (necesitaAsignacion) {
        empleadosSeleccionados.forEach(id => {
          const empleado = empleados.find(e => e.id === id);
          if (empleado) {
            empleadosAsignadosArray.push({
              id: empleado.id,
              nombre: empleado.nombre
            });
          }
        });
      }

      await avanzarEstado({
        comanda,
        empleado_id: userData.id || '',
        empleadoNombre: userData.nombre,
        turno: necesitaAsignacion ? turnoSeleccionado : undefined,
        empleadosAsignados: empleadosAsignadosArray
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al avanzar estado:', error);
      alert(error.message || 'Error al avanzar estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-spac-orange text-white p-6 rounded-t-xl">
          <h2 className="text-xl font-bold">Avanzar Estado</h2>
          <p className="text-sm opacity-90 mt-1">
            {comanda.codigoSeguimiento} - {comanda.cliente.nombre}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {necesitaAsignacion ? (
            <>
              {/* Selector de Turno */}
              <div>
                <label className="block text-sm font-semibold text-spac-dark mb-3">
                  Selecciona el Turno
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTurnoSeleccionado('A')}
                    className={`py-3 px-4 rounded-lg font-semibold transition ${
                      turnoSeleccionado === 'A'
                        ? 'bg-spac-orange text-white'
                        : 'bg-gray-100 text-spac-dark hover:bg-gray-200'
                    }`}
                  >
                    Turno A
                  </button>
                  <button
                    onClick={() => setTurnoSeleccionado('B')}
                    className={`py-3 px-4 rounded-lg font-semibold transition ${
                      turnoSeleccionado === 'B'
                        ? 'bg-spac-orange text-white'
                        : 'bg-gray-100 text-spac-dark hover:bg-gray-200'
                    }`}
                  >
                    Turno B
                  </button>
                </div>
              </div>

              {/* Selector de Empleados */}
              <div>
                <label className="block text-sm font-semibold text-spac-dark mb-3">
                  Selecciona Empleado(s)
                </label>
                
                {loadingEmpleados ? (
                  <div className="text-center py-8 text-spac-gray">
                    Cargando empleados...
                  </div>
                ) : empleados.length === 0 ? (
                  <div className="text-center py-8 text-red-600">
                    No hay empleados disponibles
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {empleados.map(empleado => (
                      <label
                        key={empleado.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                          empleadosSeleccionados.has(empleado.id)
                            ? 'border-spac-orange bg-spac-light'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={empleadosSeleccionados.has(empleado.id)}
                          onChange={() => toggleEmpleado(empleado.id)}
                          className="w-5 h-5 text-spac-orange rounded focus:ring-spac-orange"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-spac-dark">{empleado.nombre}</p>
                          <p className="text-xs text-spac-gray">ID: {empleado.id.substring(0, 8)}...</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen de selección */}
              {empleadosSeleccionados.size > 0 && (
                <div className="bg-spac-light p-4 rounded-lg">
                  <p className="text-sm font-semibold text-spac-dark mb-2">
                    📋 Resumen:
                  </p>
                  <p className="text-sm text-spac-dark-secondary">
                    Turno {turnoSeleccionado} • {empleadosSeleccionados.size} empleado(s) seleccionado(s)
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-spac-dark font-medium">
                ¿Confirmas avanzar al siguiente estado?
              </p>
              <p className="text-sm text-spac-gray mt-2">
                {comanda.estadoActual === 'pendiente' && 'Se notificará al cliente por WhatsApp'}
                {comanda.estadoActual === 'empaquetado' && `Pasará a ${comanda.tipoEntrega === 'retiro' ? 'Listo para Retiro' : 'Listo para Despacho'}`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 rounded-b-xl flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-spac-dark font-semibold rounded-lg transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAvanzar}
            disabled={loading || loadingEmpleados || (necesitaAsignacion && empleadosSeleccionados.size === 0)}
            className="flex-1 px-4 py-3 bg-spac-orange hover:bg-spac-orange-dark text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Avanzando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};