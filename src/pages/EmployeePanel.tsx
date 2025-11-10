import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import { ModalAvanzarEstado } from '../components/ModalAvanzarEstado';
import { activarDesmanche, retrocederEstado } from '../services/comandaService';
import type { Comanda, EstadoComanda } from '../types';
import { ESTADOS_CONFIG, ESTADOS_CON_EMPLEADOS } from '../types';
import logoLavanderia from '../assets/logo.png';
import {
  MdWarningAmber,
  MdKeyboardReturn
} from 'react-icons/md'

export const EmployeePanel = () => {
  const { userData } = useAuth();
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComandas, setExpandedComandas] = useState<Set<string>>(new Set());
  const [comandaSeleccionada, setComandaSeleccionada] = useState<Comanda | null>(null);

  // Manejar desmanche
  const handleDesmanche = async (comanda: Comanda) => {
    if (!userData?.id) return;
  
    if (window.confirm('¿Iniciar proceso de desmanche? La comanda volverá a lavado después.')) {
        try {
            await activarDesmanche(comanda, userData.id, userData.nombre);
        } catch (error: any) {
            alert(error.message || 'Error al activar desmanche');
        }
    }
  };

  // Manejar retroceso
  const handleRetroceder = async (comanda: Comanda) => {
    if (!userData?.id) return;
  
    if (window.confirm('¿Retroceder al estado anterior?')) {
        try {
            await retrocederEstado(comanda, userData.id, userData.nombre);
        } catch (error: any) {
            alert(error.message || 'Error al retroceder estado');
        }
    }
  };

  // Cargar comandas activas desde Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'comandas'),
      where('activo', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comandasData: Comanda[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        comandasData.push({
          id: doc.id,
          ...data,
          fechaIngreso: data.fechaIngreso?.toDate(),
          fechaRetiroLimite: data.fechaRetiroLimite?.toDate(),
          historialEstados: data.historialEstados?.map((h: any) => ({
            ...h,
            fechaCambio: h.fechaCambio?.toDate()
          })) || []
        } as Comanda);
      });

      setComandas(comandasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Agrupar comandas por estado
  const comandasPorEstado = (estado: EstadoComanda) => {
    return comandas.filter(c => c.estadoActual === estado);
  };

  // Toggle expandir/contraer comanda
  const toggleExpand = (comandaId: string) => {
    setExpandedComandas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(comandaId)) {
        newSet.delete(comandaId);
      } else {
        newSet.add(comandaId);
      }
      return newSet;
    });
  };

  // Componente de tarjeta de comanda
  const ComandaCard = ({ comanda }: { comanda: Comanda }) => {
    const isExpanded = expandedComandas.has(comanda.id);
    const config = ESTADOS_CONFIG[comanda.estadoActual];
    const mostrarEmpleados = ESTADOS_CON_EMPLEADOS.includes(comanda.estadoActual);
    const empleadosActuales = comanda.empleadosAsignados[comanda.estadoActual];
    const IconComponent = config.icon;

    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:shadow-md transition">
        {/* Header - Siempre visible */}
        <button
          onClick={() => toggleExpand(comanda.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <IconComponent className="text-2xl" />
            <div className="text-left">
              <p className="font-semibold text-spac-dark">
                {comanda.codigoSeguimiento}
              </p>
              <p className="text-sm text-spac-gray">
                {comanda.cliente.nombre} ({comanda.cliente.tipo})
              </p>
            </div>
          </div>
          <span className="text-2xl text-spac-orange">
            {isExpanded ? '−' : '+'}
          </span>
        </button>

        {/* Contenido expandible */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            
            {/* Información de turno y empleados */}
            {mostrarEmpleados && empleadosActuales && (
              <div className="mt-3 p-3 bg-spac-light rounded-lg">
                <p className="text-sm font-semibold text-spac-dark mb-2">
                  Turno {empleadosActuales.turno}:
                </p>
                <div className="space-y-1">
                  {empleadosActuales.empleados.map((emp, idx) => (
                    <p key={idx} className="text-sm text-spac-dark-secondary">
                      ID {emp.id.substring(0, 6)}... - {emp.nombre}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Información de despacho si aplica */}
            {comanda.estadoActual === 'en_despacho' && comanda.despacho && (
              <div className="p-3 bg-cyan-50 rounded-lg">
                <p className="text-sm font-semibold text-cyan-900 mb-1">
                  Repartidor
                </p>
                <p className="text-sm text-cyan-800">
                  {comanda.despacho.repartidorNombre || 'Sin asignar'}
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2 mt-3">
              {comanda.estadoActual !== 'entregado' && comanda.estadoActual !== 'en_despacho' && (
                <>
                  <button 
                    onClick={() => setComandaSeleccionada(comanda)}
                    className="flex-1 bg-spac-orange hover:bg-spac-orange-dark text-white py-2 rounded-lg font-medium transition"
                  >
                    Avanzar Estado
                  </button>
                  
                  <button className="px-4 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition"
                  title="Reportar Problema">
                    <MdWarningAmber />
                  </button>
                </>
              )}
              
              {comanda.estadoActual === 'en_despacho' && (
                <button className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition"
                >
                  Reportar Problema
                </button>
              )}
              {comanda.estadoActual === 'planchando' && !comanda.desmanche.activado && (
                <button 
                    onClick={() => handleDesmanche(comanda)}  // 👈 Debe tener esto
                    className="px-4 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg font-medium transition"
                >
                    Desmanche
                </button>
                )}

                {comanda.estadoActual !== 'pendiente' && (
                <button 
                    onClick={() => handleRetroceder(comanda)}  // 👈 Debe tener esto
                    className="px-4 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition"
                    title="Retroceder estado"
                >
                    <MdKeyboardReturn />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Sección de estado
  const SeccionEstado = ({ estado }: { estado: EstadoComanda }) => {
    const config = ESTADOS_CONFIG[estado];
    const comandasEnEstado = comandasPorEstado(estado);
    const IconComponent = config.icon;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <IconComponent className="text-3xl" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-spac-dark">
              {config.label}
            </h2>
            <p className="text-sm text-spac-gray">
              {comandasEnEstado.length} {comandasEnEstado.length === 1 ? 'comanda' : 'comandas'}
            </p>
          </div>
        </div>

        {comandasEnEstado.length === 0 ? (
          <div className="text-center py-8 text-spac-gray">
            <p className="text-sm">No hay comandas en este estado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comandasEnEstado.map(comanda => (
              <ComandaCard key={comanda.id} comanda={comanda} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-spac-light flex items-center justify-center">
        <div className="text-center">
            <img 
              src={logoLavanderia} 
              alt="Logo Lavandería El Cobre" 
              className="inline-flex items-center justify-center w-20 h-20 bg-spac-light rounded-full mb-4 overflow-hidden"
            />
          <p className="text-spac-gray">Cargando comandas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-spac-light">
      {/* Header */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-spac-dark">
              Gestión de Seguimiento
            </h1>
            <p className="text-sm text-spac-gray">
              Bienvenido, {userData?.nombre}
            </p>
          </div>
          <LogoutButton />
        </div>
      </nav>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mostrar secciones por estado */}
          <SeccionEstado estado="pendiente" />
          <SeccionEstado estado="lavando" />
          <SeccionEstado estado="secando" />
          <SeccionEstado estado="planchando" />
          <SeccionEstado estado="desmanche" />
          <SeccionEstado estado="empaquetado" />
          <SeccionEstado estado="listo_retiro" />
          <SeccionEstado estado="listo_despacho" />
          <SeccionEstado estado="en_despacho" />
        </div>
      </div>

      {/* Modal de Avanzar Estado */}
      {comandaSeleccionada && (
        <ModalAvanzarEstado
          comanda={comandaSeleccionada}
          onClose={() => setComandaSeleccionada(null)}
          onSuccess={() => {
            // El snapshot de Firestore actualizará automáticamente
            console.log('Estado avanzado exitosamente');
          }}
        />
      )}
    </div>
  );
};