import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import { ModalAvanzarEstado } from '../components/ModalAvanzarEstado';
import { ModalReportarIncidencia } from '../components/ModalReportarIncidencia';
import { activarDesmanche, retrocederEstado } from '../services/seguimientoService';
import type { Seguimiento, EstadoComanda, Comanda, ComandaCompleta } from '../types';
import { ESTADOS_CONFIG, ESTADOS_CON_OPERARIOS } from '../types';
import { 
  normalizarTipoCliente, 
  normalizarTipoEntrega, 
  generarCodigoVerificador,
  normalizarTelefono 
} from '../utils/normalize';
import logoLavanderia from '../assets/logo.png';
import {
  MdWarningAmber,
  MdKeyboardReturn
} from 'react-icons/md';

export const EmployeePanel = () => {
  const { userData } = useAuth();
  const [comandasCompletas, setComandasCompletas] = useState<ComandaCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComandas, setExpandedComandas] = useState<Set<string>>(new Set());
  const [comandaSeleccionada, setComandaSeleccionada] = useState<ComandaCompleta | null>(null);
  const [modalActivo, setModalActivo] = useState<'avanzar' | 'incidencia' | null>(null);

  // Cargar seguimientos activos (excepto entregado y en_despacho)
  useEffect(() => {
    console.log('👷 EmployeePanel: Iniciando listener de seguimientos...');
    
    const q = query(
      collection(db, 'seguimiento_3'),
      where('activo', '==', true)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('📊 Total documentos en seguimiento:', snapshot.size);
      
      const comandasData: ComandaCompleta[] = [];

      for (const docSnap of snapshot.docs) {
        const seguimientoData = docSnap.data();
        
        // Filtrar solo los estados que maneja el operario (no en_despacho ni entregado)
        if (['en_despacho', 'entregado'].includes(seguimientoData.estadoActual)) {
          continue;
        }

        const seguimiento: Seguimiento = {
          id: docSnap.id,
          ...seguimientoData,
          historialEstados: seguimientoData.historialEstados?.map((h: any) => ({
            ...h,
            fechaCambio: h.fechaCambio?.toDate()
          })) || [],
          desmanche: {
            ...seguimientoData.desmanche,
            ultimaFecha: seguimientoData.desmanche?.ultimaFecha?.toDate() || null
          },
          despacho: seguimientoData.despacho ? {
            ...seguimientoData.despacho,
            horaSalida: seguimientoData.despacho.horaSalida?.toDate() || null,
            horaEntrega: seguimientoData.despacho.horaEntrega?.toDate() || null,
            incidencia: {
              ...seguimientoData.despacho.incidencia,
              fecha: seguimientoData.despacho.incidencia?.fecha?.toDate() || null
            }
          } : undefined,
          incidencias: seguimientoData.incidencias?.map((inc: any) => ({
            ...inc,
            fecha: inc.fecha?.toDate()
          })) || [],
          fechaCreacion: seguimientoData.fechaCreacion?.toDate(),
          fechaUltimaActualizacion: seguimientoData.fechaUltimaActualizacion?.toDate()
        } as Seguimiento;

        // Obtener comanda asociada
        try {
          const comandaRef = doc(db, 'comandas_2', seguimiento.comanda_id);
          const comandaDoc = await getDoc(comandaRef);

          if (comandaDoc.exists()) {
            const comandaData = comandaDoc.data();
            const comanda: Comanda = {
              id: comandaDoc.id,
              numeroOrden: comandaData.numeroOrden,
              codigoDespacho: comandaData.codigoDespacho || generarCodigoVerificador(),
              numeroBoucher: comandaData.numeroBoucher || '',
              nombreCliente: comandaData.nombreCliente,
              telefono: normalizarTelefono(comandaData.telefono),
              tipoCliente: normalizarTipoCliente(comandaData.tipoCliente || 'Particular'),
              direccion: comandaData.direccion || undefined,
              fechaIngreso: comandaData.fechaIngreso?.toDate() || new Date(),
              horaIngreso: comandaData.horaIngreso || '',
              fechaNotificacion: comandaData.fechaNotificacion?.toDate() || undefined,
              prendas: comandaData.prendas || [],
              montoSubtotal: comandaData.montoSubtotal || 0,
              montoTotal: comandaData.montoTotal || 0,
              tipoEntrega: normalizarTipoEntrega(comandaData.tipoEntrega || 'Retiro'),
              servicioExpress: comandaData.servicioExpress || false,
              notificado: comandaData.notificado || false
            } as Comanda;

            comandasData.push({ comanda, seguimiento });
          } else {
            // Comanda eliminada - el listener la eliminará automáticamente
            console.warn(`⚠️ Comanda ${seguimiento.comanda_id} no existe, omitiendo...`);
          }
        } catch (error) {
          console.error('Error al obtener comanda:', error);
        }
      }

      console.log('✅ Comandas completas cargadas:', comandasData.length);
      setComandasCompletas(comandasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Manejar desmanche
  const handleDesmanche = async (comandaCompleta: ComandaCompleta) => {
    if (!userData?.id) return;

    if (window.confirm('¿Iniciar proceso de desmanche? El pedido volverá a lavado después.')) {
      try {
        await activarDesmanche(comandaCompleta.seguimiento, userData.id, userData.nombre);
      } catch (error: any) {
        alert(error.message || 'Error al activar desmanche');
      }
    }
  };

  // Manejar retroceso
  const handleRetroceder = async (comandaCompleta: ComandaCompleta) => {
    if (!userData?.id) return;

    if (window.confirm('¿Retroceder al estado anterior?')) {
      try {
        await retrocederEstado(comandaCompleta.seguimiento, userData.id, userData.nombre);
      } catch (error: any) {
        alert(error.message || 'Error al retroceder estado');
      }
    }
  };

  // Agrupar comandas por estado
  const comandasPorEstado = (estado: EstadoComanda) => {
    return comandasCompletas.filter(cc => cc.seguimiento.estadoActual === estado);
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

  // Abrir modales
  const abrirModalAvanzar = (comandaCompleta: ComandaCompleta) => {
    setComandaSeleccionada(comandaCompleta);
    setModalActivo('avanzar');
  };

  const abrirModalIncidencia = (comandaCompleta: ComandaCompleta) => {
    setComandaSeleccionada(comandaCompleta);
    setModalActivo('incidencia');
  };

  const cerrarModal = () => {
    setModalActivo(null);
    setComandaSeleccionada(null);
  };

  // Componente de tarjeta de comanda
  const ComandaCard = ({ comandaCompleta }: { comandaCompleta: ComandaCompleta }) => {
    const { comanda, seguimiento } = comandaCompleta;
    const isExpanded = expandedComandas.has(seguimiento.id);
    const config = ESTADOS_CONFIG[seguimiento.estadoActual];
    const mostrarOperarios = ESTADOS_CON_OPERARIOS.includes(seguimiento.estadoActual);
    const operariosActuales = seguimiento.operariosAsignados[seguimiento.estadoActual];
    const IconComponent = config.icon;

    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:shadow-md transition">
        {/* Header - Siempre visible */}
        <button
          onClick={() => toggleExpand(seguimiento.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <IconComponent className="text-2xl" />
            <div className="text-left">
              <p className="font-semibold text-spac-dark">
                {comanda.numeroOrden}
              </p>
              <p className="text-sm text-spac-gray">
                {comanda.nombreCliente} ({comanda.tipoCliente})
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
            
            {/* Información de turno y operarios */}
            {mostrarOperarios && operariosActuales && (
              <div className="mt-3 p-3 bg-spac-light rounded-lg">
                <p className="text-sm font-semibold text-spac-dark mb-2">
                  Turno {operariosActuales.turno}:
                </p>
                <div className="space-y-1">
                  {operariosActuales.operarios.map((op, idx) => (
                    <p key={idx} className="text-sm text-spac-dark-secondary">
                      ID {op.id.substring(0, 6)}... - {op.nombre}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Información adicional */}
            <div className="text-xs text-spac-gray space-y-1">
              <p>Tipo de entrega: <span className="font-medium text-spac-dark">{comanda.tipoEntrega === 'retiro' ? 'Retiro en local' : 'Despacho a domicilio'}</span></p>
              {comanda.servicioExpress && (
                <p className="text-spac-orange font-semibold">⚡ Servicio Express</p>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 mt-3">
              {seguimiento.estadoActual !== 'entregado' && seguimiento.estadoActual !== 'listo_despacho' && (
                <>
                  <button 
                    onClick={() => abrirModalAvanzar(comandaCompleta)}
                    className="flex-1 bg-spac-orange hover:bg-spac-orange-dark text-white py-2 rounded-lg font-medium transition"
                  >
                    Avanzar Estado
                  </button>
                  
                  <button 
                    onClick={() => abrirModalIncidencia(comandaCompleta)}
                    className="px-4 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition"
                    title="Reportar Problema"
                  >
                    <MdWarningAmber />
                  </button>
                </>
              )}

              {seguimiento.estadoActual === 'planchando' && !seguimiento.desmanche.activado && (
                <button 
                  onClick={() => handleDesmanche(comandaCompleta)}
                  className="px-4 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg font-medium transition"
                  title="Activar desmanche"
                >
                  Desmanche
                </button>
              )}

              {seguimiento.estadoActual !== 'pendiente' && seguimiento.estadoActual !== 'listo_despacho' && (
                <button 
                  onClick={() => handleRetroceder(comandaCompleta)}
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
              {comandasEnEstado.length} {comandasEnEstado.length === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
        </div>

        {comandasEnEstado.length === 0 ? (
          <div className="text-center py-8 text-spac-gray">
            <p className="text-sm">No hay pedidos en este estado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comandasEnEstado.map(cc => (
              <ComandaCard key={cc.seguimiento.id} comandaCompleta={cc} />
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
          <p className="text-spac-gray">Cargando pedidos...</p>
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
        </div>
      </div>

      {/* Modales */}
      {modalActivo === 'avanzar' && comandaSeleccionada && (
        <ModalAvanzarEstado
          comandaCompleta={comandaSeleccionada}
          onClose={cerrarModal}
          onSuccess={() => {
            console.log('Estado avanzado exitosamente');
          }}
        />
      )}

      {modalActivo === 'incidencia' && comandaSeleccionada && (
        <ModalReportarIncidencia
          comandaCompleta={comandaSeleccionada}
          onClose={cerrarModal}
          onSuccess={() => {
            console.log('Incidencia reportada exitosamente');
          }}
        />
      )}
    </div>
  );
};