import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
//import { obtenerComandaCompleta } from '../services/seguimientoService';
import type { ComandaCompleta, EstadoComanda, Seguimiento } from '../types';
import { ESTADOS_CONFIG } from '../types';
import logoLavanderia from '../assets/logo.png';
import { 
  BsSearch,
  BsCheckCircle,
  BsClock,
  BsArrowLeft
} from 'react-icons/bs';
import { onSnapshot, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const ClientTracking = () => {
  const { codigo: codigoParam } = useParams<{ codigo?: string }>();
  const navigate = useNavigate();
  
  const [codigoBusqueda, setCodigoBusqueda] = useState(codigoParam || '');
  const [comandaCompleta, setComandaCompleta] = useState<ComandaCompleta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados del proceso en orden
  // Estados del proceso según tipo de entrega
  const getEstadosProceso = (): EstadoComanda[] => {
    if (!comandaCompleta) {
      return [
        'pendiente',
        'lavando',
        'secando',
        'planchando',
        'empaquetado',
        'listo_retiro',
        'entregado'
      ];
    }

    const esDespacho = comandaCompleta.comanda.tipoEntrega === 'despacho';

    return [
      'pendiente',
      'lavando',
      'secando',
      'planchando',
      'empaquetado',
      ...(esDespacho ? ['listo_despacho', 'en_despacho'] : ['listo_retiro']),
      'entregado'
    ] as EstadoComanda[];
  };

  const estadosProceso = getEstadosProceso();

  // Buscar comanda al cargar si hay código en URL
  useEffect(() => {
    if (codigoParam) {
      buscarComanda(codigoParam);
    }
  }, [codigoParam]);

  const buscarComanda = async (codigo: string) => {
  if (!codigo.trim()) {
    setError('Ingresa un código de seguimiento');
    return;
  }

  try {
    setLoading(true);
    setError('');
    
    // Buscar comanda por numeroOrden
    const comandasRef = collection(db, 'comandas_2');
    const q = query(comandasRef, where('numeroOrden', '==', codigo.trim()));
    const comandaSnapshot = await getDocs(q);
    
    if (comandaSnapshot.empty) {
      setError('No se encontró ningún pedido con ese código');
      setComandaCompleta(null);
      setLoading(false);
      return;
    }
    
    const comandaDoc = comandaSnapshot.docs[0];
    const comandaId = comandaDoc.id;
    
    // Listener en tiempo real para seguimiento
    const seguimientoRef = doc(db, 'seguimiento_3', comandaId);
    const unsubscribe = onSnapshot(seguimientoRef, async (seguimientoDoc) => {
      if (!seguimientoDoc.exists()) {
        setError('No se encontró seguimiento para este pedido');
        setComandaCompleta(null);
        setLoading(false);
        return;
      }
      
      // Obtener datos de comanda
      const comandaDataActual = comandaDoc.data();
      const seguimientoData = seguimientoDoc.data();
      
      // Construir ComandaCompleta con normalización
      const { 
        normalizarTipoCliente, 
        normalizarTipoEntrega, 
        generarCodigoVerificador,
        normalizarTelefono 
      } = await import('../utils/normalize');
      
      setComandaCompleta({
        comanda: {
          id: comandaId,
          numeroOrden: comandaDataActual.numeroOrden,
          codigoDespacho: comandaDataActual.codigoDespacho || generarCodigoVerificador(),
          numeroBoucher: comandaDataActual.numeroBoucher || '',
          nombreCliente: comandaDataActual.nombreCliente,
          telefono: normalizarTelefono(comandaDataActual.telefono),
          tipoCliente: normalizarTipoCliente(comandaDataActual.tipoCliente || 'Particular'),
          direccion: comandaDataActual.direccion || undefined,
          fechaIngreso: comandaDataActual.fechaIngreso?.toDate() || new Date(),
          horaIngreso: comandaDataActual.horaIngreso || '',
          fechaNotificacion: comandaDataActual.fechaNotificacion?.toDate() || undefined,
          prendas: comandaDataActual.prendas || [],
          montoSubtotal: comandaDataActual.montoSubtotal || 0,
          montoTotal: comandaDataActual.montoTotal || 0,
          tipoEntrega: normalizarTipoEntrega(comandaDataActual.tipoEntrega || 'Retiro'),
          servicioExpress: comandaDataActual.servicioExpress || false,
          notificado: comandaDataActual.notificado || false
        },
        seguimiento: {
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
        } as Seguimiento
      });
      
      setLoading(false);
      navigate(`/seguimiento/${codigo.trim()}`, { replace: true });
    });
    
    // Guardar unsubscribe para limpieza
    return unsubscribe;
    
  } catch (err) {
    console.error('Error al buscar comanda:', err);
    setError('Error al buscar el pedido. Intenta nuevamente.');
    setComandaCompleta(null);
    setLoading(false);
  }
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    buscarComanda(codigoBusqueda);
  };

  // Determinar índice del estado actual
  const getIndiceEstadoActual = (): number => {
    if (!comandaCompleta) return -1;
    const estadoActual = comandaCompleta.seguimiento.estadoActual;
    
    // Mapeo especial para desmanche (cuenta como planchando)
    if (estadoActual === 'desmanche') {
      return estadosProceso.indexOf('planchando');
    }
    
    return estadosProceso.indexOf(estadoActual);
  };

  const indiceActual = getIndiceEstadoActual();

  // Determinar si un estado está completado, activo o pendiente
  const getEstadoVisual = (index: number): 'completado' | 'activo' | 'pendiente' => {
    if (index < indiceActual) return 'completado';
    if (index === indiceActual) return 'activo';
    return 'pendiente';
  };

  // Formatear fecha
  const formatearFecha = (fecha: Date): string => {
    return fecha.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Formatear hora
  const formatearHora = (fecha: Date): string => {
    return fecha.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getLineaWidth = (): string => {
  if (!comandaCompleta) return 'w-16';

    const esDespacho = comandaCompleta.comanda.tipoEntrega === 'despacho';
    return esDespacho ? 'w-8' : 'w-14';
  };


  return (
    <div className="min-h-screen bg-spac-light">
      {/* Header/Navbar */}
      <nav className="bg-white text-spac-dark shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={logoLavanderia} 
              alt="Logo Lavandería El Cobre" 
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Lavandería El Cobre S.P.A</h1>
              <p className="text-sm text-spac-gray hidden md:block">Seguimiento de pedidos</p>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            title="Volver"
          >
            <BsArrowLeft className="text-2xl" />
          </button>
        </div>
      </nav>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Buscador */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-spac-dark mb-4">
            Rastrea tu pedido
          </h2>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={codigoBusqueda}
                onChange={(e) => setCodigoBusqueda(e.target.value)}
                placeholder="Ingresa tu código de seguimiento"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-spac-orange focus:ring-2 focus:ring-spac-orange focus:outline-none text-spac-dark"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-spac-orange hover:bg-spac-orange-dark text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              <BsSearch />
              <span className="hidden md:inline">Buscar</span>
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-spac-orange border-t-transparent"></div>
            <p className="mt-4 text-spac-gray">Buscando tu pedido...</p>
          </div>
        )}

        {/* Resultado de búsqueda */}
        {comandaCompleta && !loading && (
          <div className="space-y-6">
            
            {/* Información del pedido */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-spac-dark">
                    Pedido {comandaCompleta.comanda.numeroOrden}
                  </h3>
                  <p className="text-spac-gray">
                    Cliente: {comandaCompleta.comanda.nombreCliente}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-spac-gray">Última actualización</p>
                  {(() => {
                    const ultimoEstado = comandaCompleta.seguimiento.historialEstados[
                      comandaCompleta.seguimiento.historialEstados.length - 1
                    ];
                    return (
                      <>
                        <p className="font-semibold text-spac-dark">
                          {formatearFecha(ultimoEstado.fechaCambio)}
                        </p>
                        <p className="text-sm text-spac-gray">
                          {formatearHora(ultimoEstado.fechaCambio)}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {comandaCompleta.comanda.servicioExpress && (
                <div className="bg-spac-orange bg-opacity-10 border-2 border-spac-orange rounded-lg p-3 mb-4">
                  <p className="text-spac-orange font-semibold">⚡ Servicio Express</p>
                </div>
              )}
            </div>

            {/* Barra de progreso visual */}
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8 overflow-x-auto">
              <h3 className="text-xl font-bold text-spac-dark mb-6">
                Estado del proceso
              </h3>
              
              <div>
                <div className="flex items-center justify-evenly min-w-[800px] md:min-w-0">
                {estadosProceso.map((estado, index) => {
                  const config = ESTADOS_CONFIG[estado];
                  const IconComponent = config.icon;
                  const estadoVisual = getEstadoVisual(index);
                  const isActual = index === indiceActual;

                  return (
                    <div key={estado} className="flex items-center">
                      {/* Nodo */}
                      <div className="flex flex-col items-center relative">
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                            estadoVisual === 'completado'
                              ? 'bg-green-500 text-white'
                              : estadoVisual === 'activo'
                              ? 'bg-spac-orange text-white scale-110 shadow-lg'
                              : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {estadoVisual === 'completado' ? (
                            <BsCheckCircle className="text-2xl" />
                          ) : (
                            <IconComponent className="text-2xl" />
                          )}
                        </div>
                        
                        <p
                          className={`mt-3 text-xs md:text-sm text-center font-medium max-w-[80px] h-8 flex items-center justify-center ${
                            isActual ? 'text-spac-orange' : 'text-spac-gray'
                          }`}
                        >
                          {config.label.replace('Procesos en ', '').replace('Listo para ', '')}
                        </p>

                        {isActual && (
                          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                            <div className="flex items-center gap-1 text-xs text-spac-orange whitespace-nowrap">
                              <BsClock />
                              <span>Actual</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Línea conectora */}
                      {index < estadosProceso.length - 1 && (
                        <div
                          className={`
                            h-1 mx-3 transition-all
                            ${estadoVisual === 'completado' ? 'bg-green-500' : 'bg-gray-200'}
                            ${getLineaWidth()}
                            md:${getLineaWidth()}
                          `}
                        />

                      )}
                    </div>
                  );
                })}
                </div>
                <div className="h-8"></div> {/* Espaciador invisible */}
              </div>
            </div>

            {/* Historial de estados */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-spac-dark mb-4">
                Historial del pedido
              </h3>
              
              <div className="space-y-3">
                {comandaCompleta.seguimiento.historialEstados
                  .slice()
                  .reverse()
                  .map((historial, index) => {
                    const config = ESTADOS_CONFIG[historial.estado];
                    const IconComponent = config.icon;

                    return (
                      <div
                        key={index}
                        className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className={`p-3 rounded-full ${config.bgColor}`}>
                          <IconComponent className={`text-xl ${config.color}`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-spac-dark">
                                {config.label}
                              </p>
                              {historial.turno && (
                                <p className="text-sm text-spac-gray">
                                  Turno {historial.turno}
                                </p>
                              )}
                              {historial.comentario && (
                                <p className="text-sm text-spac-gray mt-1">
                                  {historial.comentario}
                                </p>
                              )}
                            </div>
                            
                            <div className="text-right text-sm">
                              <p className="text-spac-gray">
                                {formatearFecha(historial.fechaCambio)}
                              </p>
                              <p className="font-semibold text-spac-dark">
                                {formatearHora(historial.fechaCambio)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Información de entrega */}
            {comandaCompleta.seguimiento.despacho && 
             comandaCompleta.seguimiento.estadoActual === 'en_despacho' && (
              <div className="bg-cyan-50 border-2 border-cyan-500 rounded-xl p-6">
                <h3 className="text-xl font-bold text-cyan-900 mb-3 flex items-center gap-2">
                  <BsClock className="text-2xl" />
                  En camino
                </h3>
                <div className="space-y-2 text-cyan-800">
                  <p>
                    <span className="font-semibold">Repartidor:</span>{' '}
                    {comandaCompleta.seguimiento.despacho.repartidorNombre}
                  </p>
                  <p>
                    <span className="font-semibold">Vehículo:</span>{' '}
                    {comandaCompleta.seguimiento.despacho.vehiculo} •{' '}
                    {comandaCompleta.seguimiento.despacho.patente}
                  </p>
                  {comandaCompleta.seguimiento.despacho.horaSalida && (
                    <p>
                      <span className="font-semibold">Hora de salida:</span>{' '}
                      {formatearHora(comandaCompleta.seguimiento.despacho.horaSalida)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pedido entregado */}
            {comandaCompleta.seguimiento.estadoActual === 'entregado' && (
              <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 text-center">
                <BsCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-900 mb-2">
                  ¡Pedido entregado!
                </h3>
                {comandaCompleta.seguimiento.despacho?.personaQueRecibe && (
                  <p className="text-green-800">
                    Recibido por: {comandaCompleta.seguimiento.despacho.personaQueRecibe}
                  </p>
                )}
                {comandaCompleta.seguimiento.despacho?.horaEntrega && (
                  <p className="text-green-800 mt-1">
                    {formatearFecha(comandaCompleta.seguimiento.despacho.horaEntrega)} •{' '}
                    {formatearHora(comandaCompleta.seguimiento.despacho.horaEntrega)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Estado inicial sin búsqueda */}
        {!comandaCompleta && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-spac-dark mb-2">
              Rastrea tu pedido
            </h3>
            <p className="text-spac-gray">
              Ingresa tu código de seguimiento para ver el estado de tu pedido
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {/*<footer className="bg-spac-dark text-white mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold mb-3">Contacto</h4>
              <p className="text-sm opacity-80">+56 9 1234 5678</p>
              <p className="text-sm opacity-80">ayuda@elcobrespa.cl</p>
              <p className="text-sm opacity-80">Av. Balmaceda 1276, Calama</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">
                © 2025 El Cobre S.P.A - Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      </footer>*/}
    </div>
  );
};