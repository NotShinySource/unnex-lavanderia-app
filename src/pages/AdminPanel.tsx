import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import type { Seguimiento, EstadoComanda, Comanda, ComandaCompleta, Incidencia } from '../types';
import { ESTADOS_CONFIG } from '../types';
import { 
  normalizarTipoCliente, 
  normalizarTipoEntrega, 
  generarCodigoVerificador,
  normalizarTelefono 
} from '../utils/normalize';
import logoLavanderia from '../assets/logo.png';
import {
  MdWarningAmber,
  MdCheckCircle,
  MdFilterList
} from 'react-icons/md';
import { BsEye } from 'react-icons/bs';

type FiltroEstado = 'todos' | EstadoComanda;
type FiltroIncidencias = 'todos' | 'con_incidencias' | 'sin_incidencias';

export const AdminPanel = () => {
  const { userData } = useAuth();
  const [comandasCompletas, setComandasCompletas] = useState<ComandaCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComandas, setExpandedComandas] = useState<Set<string>>(new Set());
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroIncidencias, setFiltroIncidencias] = useState<FiltroIncidencias>('todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Cargar seguimientos activos en tiempo real
  useEffect(() => {
    console.log('🔄 AdminPanel: Iniciando listeners en tiempo real...');
    
    const q = query(
      collection(db, 'seguimiento_3'),
      where('activo', '==', true)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('📊 Total documentos:', snapshot.size);
      
      const comandasData: ComandaCompleta[] = [];
      const comandaIds = snapshot.docs.map(doc => doc.data().comanda_id).filter(Boolean);
      const comandasMap = new Map<string, any>();

      if (comandaIds.length > 0) {
        // Obtener todas las comandas
        const comandasRefs = comandaIds.map(id => doc(db, 'comandas_2', id));
        const comandasSnapshot = await Promise.all(
          comandasRefs.map(ref => getDoc(ref))
        );

        comandasSnapshot.forEach(cmdDoc => {
            if (cmdDoc.exists()) {
                comandasMap.set(cmdDoc.id, cmdDoc.data());
            }
            });
      }

      for (const docSnap of snapshot.docs) {
        const seguimientoData = docSnap.data();

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

        const comandaData = comandasMap.get(seguimiento.comanda_id);
        if (comandaData) {
          const comanda: Comanda = {
            id: seguimiento.comanda_id,
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
        }
      }

      setComandasCompletas(comandasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Resolver incidencia
  const handleResolverIncidencia = async (seguimiento: Seguimiento, incidenciaId: string) => {
    if (!window.confirm('¿Marcar esta incidencia como resuelta?')) return;

    try {
      const incidenciasActualizadas = seguimiento.incidencias.map(inc =>
        inc.id === incidenciaId ? { ...inc, resuelta: true } : inc
      );

      await updateDoc(doc(db, 'seguimiento_3', seguimiento.id), {
        incidencias: incidenciasActualizadas,
        fechaUltimaActualizacion: new Date()
      });
    } catch (error) {
      console.error('Error al resolver incidencia:', error);
      alert('Error al resolver incidencia');
    }
  };

  // Filtrar comandas
  const comandasFiltradas = comandasCompletas.filter(cc => {
    // Filtro por estado
    if (filtroEstado !== 'todos' && cc.seguimiento.estadoActual !== filtroEstado) {
      return false;
    }

    // Filtro por incidencias
    const tieneIncidencias = cc.seguimiento.incidencias.length > 0;
    const tieneIncidenciasActivas = cc.seguimiento.incidencias.some(inc => !inc.resuelta);

    if (filtroIncidencias === 'con_incidencias' && !tieneIncidenciasActivas) {
      return false;
    }
    if (filtroIncidencias === 'sin_incidencias' && tieneIncidencias) {
      return false;
    }

    return true;
  });

  // Agrupar por estado
  const comandasPorEstado = (estado: EstadoComanda) => {
    return comandasFiltradas.filter(cc => cc.seguimiento.estadoActual === estado);
  };

  // Toggle expandir
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

  // Formatear fecha
  const formatearFecha = (fecha: Date): string => {
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // KPIs
  const totalPedidos = comandasCompletas.length;
  const conIncidencias = comandasCompletas.filter(cc => 
    cc.seguimiento.incidencias.some(inc => !inc.resuelta)
  ).length;
  const enProceso = comandasCompletas.filter(cc => 
    !['entregado', 'listo_retiro', 'listo_despacho'].includes(cc.seguimiento.estadoActual)
  ).length;

  // Componente de tarjeta de comanda
  const ComandaCard = ({ comandaCompleta }: { comandaCompleta: ComandaCompleta }) => {
    const { comanda, seguimiento } = comandaCompleta;
    const isExpanded = expandedComandas.has(seguimiento.id);
    const config = ESTADOS_CONFIG[seguimiento.estadoActual];
    const IconComponent = config.icon;
    
    const incidenciasActivas = seguimiento.incidencias.filter(inc => !inc.resuelta);
    const tieneIncidenciasActivas = incidenciasActivas.length > 0;

    return (
      <div className={`rounded-lg border-2 overflow-hidden hover:shadow-md transition ${
        tieneIncidenciasActivas ? 'border-red-500 bg-red-50' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <button
          onClick={() => toggleExpand(seguimiento.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <IconComponent className="text-2xl" />
            <div className="text-left">
              <p className="font-semibold text-spac-dark flex items-center gap-2">
                {comanda.numeroOrden}
                {tieneIncidenciasActivas && (
                  <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {incidenciasActivas.length} incidencia{incidenciasActivas.length > 1 ? 's' : ''}
                  </span>
                )}
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
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 bg-white">
            
            {/* Estado y operarios */}
            <div className="mt-3 p-3 bg-spac-light rounded-lg">
              <p className="text-sm font-semibold text-spac-dark mb-2">
                Estado: {config.label}
              </p>
              
              {seguimiento.operariosAsignados[seguimiento.estadoActual] && (
                <div>
                  <p className="text-xs font-semibold text-spac-gray mb-1">
                    Turno {seguimiento.operariosAsignados[seguimiento.estadoActual].turno}:
                  </p>
                  <div className="space-y-1">
                    {seguimiento.operariosAsignados[seguimiento.estadoActual].operarios.map((op, idx) => (
                      <p key={idx} className="text-xs text-spac-dark-secondary">
                        • {op.nombre}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Incidencias */}
            {seguimiento.incidencias.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <MdWarningAmber /> Incidencias Reportadas
                </p>
                {seguimiento.incidencias.map((inc) => (
                  <IncidenciaCard 
                    key={inc.id} 
                    incidencia={inc}
                    seguimiento={seguimiento}
                    onResolver={handleResolverIncidencia}
                  />
                ))}
              </div>
            )}

            {/* Información adicional */}
            <div className="text-xs text-spac-gray space-y-1 bg-gray-50 p-3 rounded-lg">
              <p>Tipo de entrega: <span className="font-medium text-spac-dark">{comanda.tipoEntrega}</span></p>
              <p>Última actualización: <span className="font-medium text-spac-dark">{formatearFecha(seguimiento.fechaUltimaActualizacion)}</span></p>
              {comanda.servicioExpress && (
                <p className="text-spac-orange font-semibold">⚡ Servicio Express</p>
              )}
            </div>

            {/* Historial */}
            <details className="bg-gray-50 p-3 rounded-lg">
              <summary className="cursor-pointer text-sm font-semibold text-spac-dark flex items-center gap-2">
                <BsEye /> Ver Historial Completo
              </summary>
              <div className="mt-3 space-y-2">
                {seguimiento.historialEstados.slice().reverse().map((h, idx) => (
                  <div key={idx} className="text-xs border-l-2 border-spac-orange pl-3 py-1">
                    <p className="font-semibold text-spac-dark">{ESTADOS_CONFIG[h.estado].label}</p>
                    <p className="text-spac-gray">{h.operarioNombre} • {formatearFecha(h.fechaCambio)}</p>
                    {h.comentario && <p className="text-spac-gray italic">{h.comentario}</p>}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    );
  };

  // Componente de incidencia
  const IncidenciaCard = ({ 
    incidencia, 
    seguimiento,
    onResolver 
  }: { 
    incidencia: Incidencia;
    seguimiento: Seguimiento;
    onResolver: (seg: Seguimiento, incId: string) => void;
  }) => (
    <div className={`p-3 rounded-lg border-2 ${
      incidencia.resuelta 
        ? 'bg-green-50 border-green-200' 
        : 'bg-red-50 border-red-300'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-spac-dark">
            {incidencia.tipo.replace('_', ' ').toUpperCase()}
            {incidencia.resuelta && (
              <span className="ml-2 text-green-600">✓ Resuelta</span>
            )}
          </p>
          <p className="text-xs text-spac-gray mt-1">{incidencia.descripcion}</p>
          <p className="text-xs text-spac-gray mt-2">
            Reportado por: {incidencia.operarioNombre} • {formatearFecha(incidencia.fecha)}
          </p>
        </div>
        
        {!incidencia.resuelta && (
          <button
            onClick={() => onResolver(seguimiento, incidencia.id)}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition flex items-center gap-1"
          >
            <MdCheckCircle />
            Resolver
          </button>
        )}
      </div>
    </div>
  );

  // Sección de estado
  const SeccionEstado = ({ estado }: { estado: EstadoComanda }) => {
    const config = ESTADOS_CONFIG[estado];
    const comandasEnEstado = comandasPorEstado(estado);
    const IconComponent = config.icon;

    if (comandasEnEstado.length === 0) return null;

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

        <div className="space-y-3">
          {comandasEnEstado.map(cc => (
            <ComandaCard key={cc.seguimiento.id} comandaCompleta={cc} />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-spac-light flex items-center justify-center">
        <div className="text-center">
          <img 
            src={logoLavanderia} 
            alt="Logo" 
            className="inline-flex w-20 h-20 mb-4"
          />
          <p className="text-spac-gray">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-spac-light">
      {/* Header */}
      <nav className="bg-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-spac-dark">Panel de Administración</h1>
            <p className="text-sm text-spac-gray">Bienvenido, {userData?.nombre}</p>
          </div>
          <LogoutButton />
        </div>
      </nav>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-3xl font-bold text-spac-orange">{totalPedidos}</p>
            <p className="text-sm text-spac-gray">Total Pedidos Activos</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-3xl font-bold text-blue-600">{enProceso}</p>
            <p className="text-sm text-spac-gray">En Proceso</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-3xl font-bold text-red-600">{conIncidencias}</p>
            <p className="text-sm text-spac-gray">Con Incidencias Activas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="flex items-center gap-2 font-semibold text-spac-dark"
          >
            <MdFilterList className="text-xl" />
            Filtros {mostrarFiltros ? '▼' : '▶'}
          </button>

          {mostrarFiltros && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-spac-dark mb-2">
                  Filtrar por Estado
                </label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="todos">Todos los estados</option>
                  {Object.keys(ESTADOS_CONFIG).map(estado => (
                    <option key={estado} value={estado}>
                      {ESTADOS_CONFIG[estado as EstadoComanda].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-spac-dark mb-2">
                  Filtrar por Incidencias
                </label>
                <select
                  value={filtroIncidencias}
                  onChange={(e) => setFiltroIncidencias(e.target.value as FiltroIncidencias)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="todos">Todos</option>
                  <option value="con_incidencias">Con incidencias activas</option>
                  <option value="sin_incidencias">Sin incidencias</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Pedidos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['pendiente', 'lavando', 'secando', 'planchando', 'desmanche', 'empaquetado', 'listo_retiro', 'listo_despacho'] as EstadoComanda[]).map(estado => (
            <SeccionEstado key={estado} estado={estado} />
          ))}
        </div>
      </div>
    </div>
  );
};