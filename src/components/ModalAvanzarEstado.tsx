import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ComandaCompleta, Turno, OperarioAsignado } from '../types';
import { avanzarEstado } from '../services/seguimientoService';
import { useAuth } from '../contexts/AuthContext';

interface ModalAvanzarEstadoProps {
  comandaCompleta: ComandaCompleta;
  onClose: () => void;
  onSuccess: () => void;
}

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
}

export const ModalAvanzarEstado = ({ comandaCompleta, onClose, onSuccess }: ModalAvanzarEstadoProps) => {
  const { userData } = useAuth();
  const { comanda, seguimiento } = comandaCompleta;
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno>('A');
  const [operarios, setOperarios] = useState<Usuario[]>([]);
  const [operariosSeleccionados, setOperariosSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingOperarios, setLoadingOperarios] = useState(true);

  // Determinar si necesitamos asignar operarios
  const necesitaAsignacion = seguimiento.estadoActual === 'pendiente' || 
    ['lavando', 'secando', 'planchando', 'desmanche'].includes(seguimiento.estadoActual);

  // Cargar operarios disponibles
  useEffect(() => {
    const cargarOperarios = async () => {
      try {
        const q = query(
          collection(db, 'usuarios'),
          where('rol', '==', 'operario'),
          where('activo', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const operariosData: Usuario[] = [];
        
        snapshot.forEach(doc => {
          operariosData.push({
            id: doc.id,
            nombre: doc.data().nombre,
            rol: doc.data().rol
          });
        });
        
        setOperarios(operariosData);
      } catch (error) {
        console.error('Error al cargar operarios:', error);
      } finally {
        setLoadingOperarios(false);
      }
    };

    if (necesitaAsignacion) {
      cargarOperarios();
    } else {
      setLoadingOperarios(false);
    }
  }, [necesitaAsignacion]);

  // Toggle selección de operario
  const toggleOperario = (operarioId: string) => {
    setOperariosSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(operarioId)) {
        newSet.delete(operarioId);
      } else {
        newSet.add(operarioId);
      }
      return newSet;
    });
  };

  // Manejar avance de estado
  const handleAvanzar = async () => {
    if (!userData) return;

    // Validar que se hayan seleccionado operarios si es necesario
    if (necesitaAsignacion && operariosSeleccionados.size === 0) {
      alert('Debes seleccionar al menos un operario');
      return;
    }

    try {
      setLoading(true);

      const operariosAsignadosArray: OperarioAsignado[] = [];
      
      if (necesitaAsignacion) {
        operariosSeleccionados.forEach(id => {
          const operario = operarios.find(e => e.id === id);
          if (operario) {
            operariosAsignadosArray.push({
              id: operario.id,
              nombre: operario.nombre
            });
          }
        });
      }

      await avanzarEstado({
        seguimiento,
        operario_id: userData.id || '',
        operarioNombre: userData.nombre,
        turno: necesitaAsignacion ? turnoSeleccionado : undefined,
        operariosAsignados: operariosAsignadosArray
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

  // Obtener texto descriptivo del siguiente estado
  const getTextoSiguienteEstado = (): string => {
    const estado = seguimiento.estadoActual;
    
    if (estado === 'pendiente') return 'Pasará a Lavado';
    if (estado === 'lavando') return 'Pasará a Secado';
    if (estado === 'secando') return 'Pasará a Planchado';
    if (estado === 'planchando') return 'Pasará a Empaquetado';
    if (estado === 'desmanche') return 'Volverá a Lavado';
    if (estado === 'empaquetado') {
      return comanda.tipoEntrega === 'retiro' 
        ? 'Pasará a Listo para Retiro' 
        : 'Pasará a Listo para Despacho';
    }
    if (estado === 'listo_retiro') return 'Marcará como Entregado';
    if (estado === 'listo_despacho') return 'Esperando asignación de repartidor';
    
    return 'Avanzar al siguiente estado';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-spac-orange text-white p-6 rounded-t-xl">
          <h2 className="text-xl font-bold">Avanzar Estado</h2>
          <p className="text-sm opacity-90 mt-1">
            {comanda.numeroOrden} - {comanda.nombreCliente}
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

              {/* Selector de Operarios */}
              <div>
                <label className="block text-sm font-semibold text-spac-dark mb-3">
                  Selecciona Operario(s)
                </label>
                
                {loadingOperarios ? (
                  <div className="text-center py-8 text-spac-gray">
                    Cargando operarios...
                  </div>
                ) : operarios.length === 0 ? (
                  <div className="text-center py-8 text-red-600">
                    No hay operarios disponibles
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {operarios.map(operario => (
                      <label
                        key={operario.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                          operariosSeleccionados.has(operario.id)
                            ? 'border-spac-orange bg-spac-light'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={operariosSeleccionados.has(operario.id)}
                          onChange={() => toggleOperario(operario.id)}
                          className="w-5 h-5 text-spac-orange rounded focus:ring-spac-orange"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-spac-dark">{operario.nombre}</p>
                          <p className="text-xs text-spac-gray">ID: {operario.id.substring(0, 8)}...</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen de selección */}
              {operariosSeleccionados.size > 0 && (
                <div className="bg-spac-light p-4 rounded-lg">
                  <p className="text-sm font-semibold text-spac-dark mb-2">
                    📋 Resumen:
                  </p>
                  <p className="text-sm text-spac-dark-secondary">
                    Turno {turnoSeleccionado} • {operariosSeleccionados.size} operario(s) seleccionado(s)
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-spac-dark font-medium mb-2">
                ¿Confirmas avanzar al siguiente estado?
              </p>
              <p className="text-sm text-spac-gray">
                {getTextoSiguienteEstado()}
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
            disabled={loading || loadingOperarios || (necesitaAsignacion && operariosSeleccionados.size === 0)}
            className="flex-1 px-4 py-3 bg-spac-orange hover:bg-spac-orange-dark text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Avanzando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};