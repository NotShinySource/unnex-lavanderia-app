import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, /*doc, getDoc*/ } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Comanda, Seguimiento, ComandaCompleta } from '../types';
import { ESTADOS_CONFIG } from '../types';
import Loader from '../components/Loader';
import { 
  normalizarTipoCliente, 
  normalizarTipoEntrega, 
  generarCodigoVerificador,
  normalizarTelefono 
} from '../utils/normalize';
import { BsEye } from 'react-icons/bs';

export const ClientPanel = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const [comandasCompletas, setComandasCompletas] = useState<ComandaCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComandas, setExpandedComandas] = useState<Set<string>>(new Set());

  // Cargar comandas del cliente automáticamente
  useEffect(() => {
    if (!userData?.telefono) {
      setLoading(false);
      return;
    }

    console.log('📱 Buscando pedidos para teléfono:', userData.telefono);

    // Normalizar el teléfono del usuario
    const telefonoNormalizado = normalizarTelefono(userData.telefono);

    // CAMBIO 1: Variable para almacenar el unsubscribe de seguimientos
    let unsubscribeSeguimientos: (() => void) | null = null;

    // Buscar comandas con ese teléfono
    const comandasRef = collection(db, 'comandas_2');
    const q = query(comandasRef, where('telefono', '==', telefonoNormalizado));

    const unsubscribeComandas = onSnapshot(q, async (comandaSnapshot) => {
      console.log('📦 Comandas encontradas:', comandaSnapshot.size);

      if (comandaSnapshot.empty) {
        setComandasCompletas([]);
        setLoading(false);
        return;
      }

      // Obtener IDs de comandas
      const comandaIds = comandaSnapshot.docs.map(doc => doc.id);

      // ⭐ CAMBIO 2: Si ya existe un listener de seguimientos, cancelarlo
      if (unsubscribeSeguimientos) {
        unsubscribeSeguimientos();
      }

      // Listener en tiempo real para todos los seguimientos
      const seguimientosRef = collection(db, 'seguimiento_3');
      const seguimientosQuery = query(
        seguimientosRef,
        where('comanda_id', 'in', comandaIds)
      );

      // ⭐ CAMBIO 3: Asignar el unsubscribe a la variable externa
      unsubscribeSeguimientos = onSnapshot(seguimientosQuery, (seguimientosSnapshot) => {
        const comandasData: ComandaCompleta[] = [];

        // ⭐ CAMBIO 4: Crear un Map de comandas para búsqueda eficiente
        const comandasMap = new Map();
        comandaSnapshot.docs.forEach(doc => {
          comandasMap.set(doc.id, doc);
        });

        seguimientosSnapshot.forEach(seguimientoDoc => {
          const seguimientoData = seguimientoDoc.data();
          const comandaDoc = comandasMap.get(seguimientoData.comanda_id);

          if (comandaDoc) {
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
            };

            const seguimiento: Seguimiento = {
              id: seguimientoDoc.id,
              ...seguimientoData,
              historialEstados: seguimientoData.historialEstados?.map((h: any) => ({
                ...h,
                fechaCambio: h.fechaCambio?.toDate() || new Date()
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
                fecha: inc.fecha?.toDate() || new Date()
              })) || [],
              fechaCreacion: seguimientoData.fechaCreacion?.toDate() || new Date(),
              fechaUltimaActualizacion: seguimientoData.fechaUltimaActualizacion?.toDate() || new Date()
            } as Seguimiento;

            comandasData.push({ comanda, seguimiento });
          }
        });

        // Ordenar por fecha de creación (más recientes primero)
        comandasData.sort((a, b) => 
          b.seguimiento.fechaCreacion.getTime() - a.seguimiento.fechaCreacion.getTime()
        );

        setComandasCompletas(comandasData);
        setLoading(false);
      });
    });

    // ⭐ CAMBIO 5: Cleanup que cancela AMBOS listeners
    return () => {
      unsubscribeComandas();
      if (unsubscribeSeguimientos) {
        unsubscribeSeguimientos();
      }
    };
  }, [userData]);

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

  const handleVerDetalles = (numeroOrden: string) => {
    navigate(`/seguimiento/${numeroOrden}?from=panel`);
  };

  // Formatear fecha
  const formatearFecha = (fecha: Date): string => {
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Componente de tarjeta de comanda
  const ComandaCard = ({ comandaCompleta }: { comandaCompleta: ComandaCompleta }) => {
    const { comanda, seguimiento } = comandaCompleta;
    const isExpanded = expandedComandas.has(seguimiento.id);
    const config = ESTADOS_CONFIG[seguimiento.estadoActual];
    const IconComponent = config.icon;

    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:shadow-md transition">
        {/* Header - Siempre visible */}
        <button
          onClick={() => toggleExpand(seguimiento.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <IconComponent className={`text-xl ${config.color}`} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-spac-dark">
                {comanda.numeroOrden}
              </p>
              <p className="text-sm text-spac-gray">
                {formatearFecha(comanda.fechaIngreso)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.color}`}>
              {config.label.replace('Procesos en ', '').replace('Procesos ', '').replace('Listo para ', '')}
            </span>
            <span className="text-2xl text-spac-orange">
              {isExpanded ? '−' : '+'}
            </span>
          </div>
        </button>

        {/* Contenido expandible */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            
            {/* Estado actual detallado */}
            <div className="mt-3 p-4 bg-spac-light rounded-lg">
              <p className="text-sm font-semibold text-spac-dark mb-2">
                📍 Estado Actual
              </p>
              <p className="text-spac-dark-secondary">
                {config.label}
              </p>
              <p className="text-xs text-spac-gray mt-2">
                Última actualización: {formatearFecha(seguimiento.fechaUltimaActualizacion)} • {
                  seguimiento.fechaUltimaActualizacion.toLocaleTimeString('es-CL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                }
              </p>
            </div>

            {/* Información adicional */}
            <div className="text-xs text-spac-gray space-y-1 bg-gray-50 p-3 rounded-lg">
              <p>
                <span className="font-medium text-spac-dark">Tipo de entrega:</span>{' '}
                {comanda.tipoEntrega === 'retiro' ? 'Retiro en local' : 'Despacho a domicilio'}
              </p>
              {comanda.servicioExpress && (
                <p className="text-spac-orange font-semibold">⚡ Servicio Express</p>
              )}
              <p>
                <span className="font-medium text-spac-dark">Monto total:</span>{' '}
                ${comanda.montoTotal.toLocaleString('es-CL')}
              </p>
              <p>
                <span className="font-medium text-spac-dark">Prendas:</span>{' '}
                {comanda.prendas.reduce((acc, p) => acc + p.cantidad, 0)} unidades
              </p>
            </div>

            {/* Botón para ver detalles completos */}
            <button
              onClick={() => handleVerDetalles(comanda.numeroOrden)}
              className="w-full bg-spac-orange hover:bg-spac-orange-dark text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <BsEye className="text-xl" />
              Ver Seguimiento Detallado
            </button>
          </div>
        )}
      </div>
    );
  };

  // Estadísticas rápidas
  const pedidosActivos = comandasCompletas.filter(cc => cc.seguimiento.activo).length;
  const pedidosEntregados = comandasCompletas.filter(cc => cc.seguimiento.estadoActual === 'entregado').length;
  const totalGastado = comandasCompletas.reduce((acc, cc) => acc + cc.comanda.montoTotal, 0);

  if (loading) {
    return (
      <Loader fullScreen text="Cargando tus pedidos..." />
    );
  }

  return (
    <div className="min-h-screen bg-spac-light">
      {/* Header */}
      <nav className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-spac-dark">Mis Pedidos</h1>
            <p className="text-sm text-spac-gray">{userData?.nombre}</p>
          </div>
        </div>
      </nav>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Estadísticas */}
        {comandasCompletas.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <p className="text-2xl font-bold text-spac-orange">{pedidosActivos}</p>
              <p className="text-sm text-spac-gray">Activos</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{pedidosEntregados}</p>
              <p className="text-sm text-spac-gray">Entregados</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">${Math.floor(totalGastado / 1000)}k</p>
              <p className="text-sm text-spac-gray">Total Gastado</p>
            </div>
          </div>
        )}

        {/* Lista de pedidos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-spac-dark">Todos tus Pedidos</h2>
            <span className="bg-spac-orange bg-opacity-20 text-spac-orange px-3 py-1 rounded-full text-sm font-semibold">
              {comandasCompletas.length} {comandasCompletas.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>

          {comandasCompletas.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center shadow-md">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-spac-dark mb-2">
                No tienes pedidos aún
              </h3>
              <p className="text-spac-gray">
                Cuando realices un pedido, aparecerá aquí
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comandasCompletas.map(cc => (
                <ComandaCard key={cc.seguimiento.id} comandaCompleta={cc} />
              ))}
            </div>
          )}
        </section>
        {/*
        <div className="bg-white rounded-lg shadow-md p-4 text-center">
          <p className="text-sm text-spac-gray mb-2">
            ¿Quieres compartir el seguimiento con alguien?
          </p>
          <button
            onClick={() => navigate('/seguimiento')}
            className="text-spac-orange hover:text-spac-orange-dark font-semibold text-sm"
          >
            Ir al seguimiento público →
          </button>
        </div>
        */}
      </div>
    </div>
  );
};