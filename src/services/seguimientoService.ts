import { 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion, 
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { 
  EstadoComanda, 
  Turno, 
  OperarioAsignado, 
  Seguimiento,
  Comanda,
  ComandaCompleta,
  TipoIncidencia,
  TipoIncidenciaDespacho
} from '../types';
import { 
  normalizarTipoCliente, 
  normalizarTipoEntrega, 
  normalizarEstadoComanda,
  generarCodigoVerificador,
  normalizarTelefono
} from '../utils/normalize';

// ============================================
// MAPEO DE FLUJO DE ESTADOS
// ============================================
const SIGUIENTE_ESTADO: Record<EstadoComanda, EstadoComanda | null> = {
  pendiente: 'lavando',
  lavando: 'secando',
  secando: 'planchando',
  planchando: 'empaquetado',
  desmanche: 'lavando',
  empaquetado: null, // Se decide entre listo_retiro o listo_despacho
  listo_retiro: 'entregado',
  listo_despacho: 'en_despacho',
  en_despacho: 'entregado',
  entregado: null
};

// ============================================
// INICIALIZACIÓN DE SEGUIMIENTO
// ============================================

/**
 * Inicializa el listener para crear automáticamente
 * registros de seguimiento cuando se crean nuevas comandas
 */
/**
 * Inicializa el listener para crear automáticamente
 * registros de seguimiento cuando se crean nuevas comandas
 * Y actualiza el seguimiento cuando se modifican datos de la comanda
 */
export const inicializarListenerComandas = (
  onNuevaComanda?: (comanda: Comanda) => void
): (() => void) => {
  const comandasRef = collection(db, 'comandas_2');
  
  return onSnapshot(comandasRef, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      const comandaData = change.doc.data();
      const comandaId = change.doc.id;
      
      try {
        const seguimientoRef = doc(db, 'seguimiento_3', comandaId);
        const seguimientoDoc = await getDoc(seguimientoRef);
        
        if (change.type === 'added') {
          // NUEVA COMANDA - Crear seguimiento
          if (!seguimientoDoc.exists()) {
            const tipoEntrega = normalizarTipoEntrega(comandaData.tipoEntrega || 'Retiro');
            
            const seguimientoBase: any = {
              comanda_id: comandaId,
              numeroOrden: comandaData.numeroOrden || `ORD-${Date.now()}`,
              estadoActual: 'pendiente',
              turnoActual: null,
              activo: normalizarEstadoComanda(comandaData.estado),
              historialEstados: [{
                estado: 'pendiente',
                fechaCambio: Timestamp.now(),
                operario_id: 'sistema',
                operarioNombre: 'Sistema',
                turno: null,
                comentario: 'Comanda creada'
              }],
              operariosAsignados: {},
              desmanche: {
                activado: false,
                veces: 0,
                ultimaFecha: null,
                operario_id: null,
                operarioNombre: null
              },
              incidencias: [],
              fechaCreacion: Timestamp.now(),
              fechaUltimaActualizacion: Timestamp.now()
            };

            if (tipoEntrega === 'despacho') {
              seguimientoBase.despacho = {
                estadoDespacho: 'pendiente',
                repartidor_id: null,
                repartidorNombre: null,
                vehiculo: null,
                patente: null,
                horaSalida: null,
                horaEntrega: null,
                codigoVerificado: false,
                personaQueRecibe: null,
                incidencia: {
                  tieneIncidencia: false,
                  tipo: null,
                  descripcion: null,
                  fecha: null
                }
              };
            }
            
            await setDoc(seguimientoRef, seguimientoBase);
            console.log(`✅ Seguimiento creado para comanda: ${comandaData.numeroOrden}`);
            
            if (onNuevaComanda) {
              onNuevaComanda({
                id: comandaId,
                numeroOrden: comandaData.numeroOrden,
                codigoDespacho: comandaData.codigoDespacho || generarCodigoVerificador(),
                numeroBoucher: comandaData.numeroBoucher || '',
                nombreCliente: comandaData.nombreCliente,
                telefono: normalizarTelefono(comandaData.telefono),
                tipoCliente: normalizarTipoCliente(comandaData.tipoCliente || 'Particular'),
                direccion: comandaData.direccion || undefined,
                fechaIngreso: comandaData.fechaIngreso?.toDate?.() || new Date(),
                horaIngreso: comandaData.horaIngreso || '',
                fechaNotificacion: comandaData.fechaNotificacion?.toDate?.() || undefined,
                prendas: comandaData.prendas || [],
                montoSubtotal: comandaData.montoSubtotal || 0,
                montoTotal: comandaData.montoTotal || 0,
                tipoEntrega,
                servicioExpress: comandaData.servicioExpress || false,
                notificado: comandaData.notificado || false
              } as Comanda);
            }
          }
        } else if (change.type === 'modified') {
          // COMANDA MODIFICADA - Actualizar numeroOrden en seguimiento si existe
          if (seguimientoDoc.exists()) {
            await updateDoc(seguimientoRef, {
              numeroOrden: comandaData.numeroOrden || seguimientoDoc.data().numeroOrden,
              fechaUltimaActualizacion: Timestamp.now()
            });
            console.log(`🔄 Seguimiento actualizado para comanda: ${comandaData.numeroOrden}`);
          }
        } else if (change.type === 'removed') {
          // COMANDA ELIMINADA - Eliminar seguimiento asociado
          if (seguimientoDoc.exists()) {
            await deleteDoc(seguimientoRef);
            console.log(`🗑️ Seguimiento eliminado para comanda: ${comandaId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error al procesar comanda ${comandaId}:`, error);
      }
    }
  });
};

// ============================================
// CONSULTAS
// ============================================

/**
 * Obtiene una comanda completa (comanda + seguimiento)
 */
/**
 * Obtiene una comanda completa (comanda + seguimiento)
 */
export const obtenerComandaCompleta = async (
  numeroOrden: string
): Promise<ComandaCompleta | null> => {
  try {
    // Buscar en comandas por numeroOrden
    const comandasRef = collection(db, 'comandas_2');
    const q = query(comandasRef, where('numeroOrden', '==', numeroOrden));
    const comandaSnapshot = await getDocs(q);
    
    if (comandaSnapshot.empty) {
      return null;
    }
    
    const comandaDoc = comandaSnapshot.docs[0];
    const comandaData = comandaDoc.data();
    const comandaId = comandaDoc.id;
    
    // Obtener seguimiento
    const seguimientoRef = doc(db, 'seguimiento_3', comandaId);
    const seguimientoDoc = await getDoc(seguimientoRef);
    
    if (!seguimientoDoc.exists()) {
      return null;
    }
    
    const seguimientoData = seguimientoDoc.data();
    
    return {
      comanda: {
        id: comandaId,
        numeroOrden: comandaData.numeroOrden,
        codigoDespacho: comandaData.codigoDespacho || generarCodigoVerificador(),
        numeroBoucher: comandaData.numeroBoucher || '',
        nombreCliente: comandaData.nombreCliente,
        telefono: normalizarTelefono(comandaData.telefono),
        tipoCliente: normalizarTipoCliente(comandaData.tipoCliente || 'Particular'),
        direccion: comandaData.direccion || undefined,
        fechaIngreso: comandaData.fechaIngreso?.toDate?.() || new Date(),
        horaIngreso: comandaData.horaIngreso || '',
        fechaNotificacion: comandaData.fechaNotificacion?.toDate?.() || undefined,
        prendas: comandaData.prendas || [],
        montoSubtotal: comandaData.montoSubtotal || 0,
        montoTotal: comandaData.montoTotal || 0,
        tipoEntrega: normalizarTipoEntrega(comandaData.tipoEntrega || 'Retiro'),
        servicioExpress: comandaData.servicioExpress || false,
        notificado: comandaData.notificado || false
      } as Comanda,
      seguimiento: {
        id: seguimientoDoc.id,
        ...seguimientoData,
        historialEstados: seguimientoData.historialEstados?.map((h: any) => ({
          ...h,
          fechaCambio: h.fechaCambio?.toDate?.() || new Date()
        })) || [],
        desmanche: {
          ...seguimientoData.desmanche,
          ultimaFecha: seguimientoData.desmanche?.ultimaFecha?.toDate?.() || null
        },
        despacho: seguimientoData.despacho ? {
          ...seguimientoData.despacho,
          horaSalida: seguimientoData.despacho.horaSalida?.toDate?.() || null,
          horaEntrega: seguimientoData.despacho.horaEntrega?.toDate?.() || null,
          incidencia: {
            ...seguimientoData.despacho.incidencia,
            fecha: seguimientoData.despacho.incidencia?.fecha?.toDate?.() || null
          }
        } : undefined,
        incidencias: seguimientoData.incidencias?.map((inc: any) => ({
          ...inc,
          fecha: inc.fecha?.toDate?.() || new Date()
        })) || [],
        fechaCreacion: seguimientoData.fechaCreacion?.toDate?.() || new Date(),
        fechaUltimaActualizacion: seguimientoData.fechaUltimaActualizacion?.toDate?.() || new Date()
      } as Seguimiento
    };
  } catch (error) {
    console.error('Error al obtener comanda completa:', error);
    throw error;
  }
};

/**
 * Obtiene solo el seguimiento por ID
 */
export const obtenerSeguimiento = async (
  seguimientoId: string
): Promise<Seguimiento | null> => {
  try {
    const seguimientoRef = doc(db, 'seguimiento_3', seguimientoId);
    const seguimientoDoc = await getDoc(seguimientoRef);
    
    if (!seguimientoDoc.exists()) {
      return null;
    }
    
    const data = seguimientoDoc.data();
    return {
      id: seguimientoDoc.id,
      ...data,
      historialEstados: data.historialEstados?.map((h: any) => ({
        ...h,
        fechaCambio: h.fechaCambio?.toDate?.() || new Date()
      })) || [],
      desmanche: {
        ...data.desmanche,
        ultimaFecha: data.desmanche?.ultimaFecha?.toDate?.() || null
      },
      despacho: data.despacho ? {
        ...data.despacho,
        horaSalida: data.despacho.horaSalida?.toDate?.() || null,
        horaEntrega: data.despacho.horaEntrega?.toDate?.() || null,
        incidencia: {
          ...data.despacho.incidencia,
          fecha: data.despacho.incidencia?.fecha?.toDate?.() || null
        }
      } : undefined,
      incidencias: data.incidencias?.map((inc: any) => ({
        ...inc,
        fecha: inc.fecha?.toDate?.() || new Date()
      })) || [],
      fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(),
      fechaUltimaActualizacion: data.fechaUltimaActualizacion?.toDate?.() || new Date()
    } as Seguimiento;
  } catch (error) {
    console.error('Error al obtener seguimiento:', error);
    throw error;
  }
};

// ============================================
// AVANCE DE ESTADOS (OPERARIOS)
// ============================================

interface AvanzarEstadoParams {
  seguimiento: Seguimiento;
  operario_id: string;
  operarioNombre: string;
  turno?: Turno;
  operariosAsignados?: OperarioAsignado[];
}

/**
 * Avanza un seguimiento al siguiente estado
 */
export const avanzarEstado = async ({
  seguimiento,
  operario_id,
  operarioNombre,
  turno,
  operariosAsignados = []
}: AvanzarEstadoParams): Promise<void> => {
  const estadoActual = seguimiento.estadoActual;
  let siguienteEstado = SIGUIENTE_ESTADO[estadoActual];

  // Caso especial: empaquetado debe decidir entre retiro o despacho
  if (estadoActual === 'empaquetado') {
    // Necesitamos obtener la comanda para saber el tipoEntrega
    const comandaRef = doc(db, 'comandas_2', seguimiento.comanda_id);
    const comandaDoc = await getDoc(comandaRef);
    
    if (!comandaDoc.exists()) {
      throw new Error('Comanda no encontrada');
    }
    
    const comandaData = comandaDoc.data();
    const tipoEntrega = normalizarTipoEntrega(comandaData.tipoEntrega || 'Retiro');
    siguienteEstado = tipoEntrega === 'retiro' ? 'listo_retiro' : 'listo_despacho';
  }

  if (!siguienteEstado) {
    throw new Error('No hay siguiente estado disponible');
  }

  // Preparar actualización del historial
  const nuevoHistorial = {
    estado: siguienteEstado,
    fechaCambio: Timestamp.now(),
    operario_id,
    operarioNombre,
    turno: turno || null,
    comentario: `Avanzó de ${estadoActual} a ${siguienteEstado}`
  };

  // Preparar datos de actualización
  const updateData: any = {
    estadoActual: siguienteEstado,
    historialEstados: arrayUnion(nuevoHistorial),
    fechaUltimaActualizacion: Timestamp.now()
  };

  // Si se proporciona turno, actualizarlo
  if (turno) {
    updateData.turnoActual = turno;
  }

  // Si hay operarios asignados, guardarlos
  if (operariosAsignados.length > 0 && turno) {
    updateData[`operariosAsignados.${siguienteEstado}`] = {
      turno,
      operarios: operariosAsignados
    };
  }

  // Actualizar en Firestore
  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

// ============================================
// DESMANCHE
// ============================================

/**
 * Activa el proceso de desmanche
 */
export const activarDesmanche = async (
  seguimiento: Seguimiento,
  operario_id: string,
  operarioNombre: string
): Promise<void> => {
  const nuevoHistorial = {
    estado: 'desmanche' as EstadoComanda,
    fechaCambio: Timestamp.now(),
    operario_id,
    operarioNombre,
    turno: seguimiento.turnoActual,
    comentario: 'Iniciado proceso de desmanche'
  };

  const updateData = {
    estadoActual: 'desmanche' as EstadoComanda,
    historialEstados: arrayUnion(nuevoHistorial),
    'desmanche.activado': true,
    'desmanche.veces': (seguimiento.desmanche.veces || 0) + 1,
    'desmanche.ultimaFecha': Timestamp.now(),
    'desmanche.operario_id': operario_id,
    'desmanche.operarioNombre': operarioNombre,
    fechaUltimaActualizacion: Timestamp.now()
  };

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

/**
 * Retrocede un seguimiento al estado anterior
 */
export const retrocederEstado = async (
  seguimiento: Seguimiento,
  operario_id: string,
  operarioNombre: string
): Promise<void> => {
  if (seguimiento.historialEstados.length < 2) {
    throw new Error('No hay estado anterior al cual retroceder');
  }

  const estadoAnterior = seguimiento.historialEstados[seguimiento.historialEstados.length - 2].estado;

  const nuevoHistorial = {
    estado: estadoAnterior,
    fechaCambio: Timestamp.now(),
    operario_id,
    operarioNombre,
    turno: seguimiento.turnoActual,
    comentario: `Retrocedió de ${seguimiento.estadoActual} a ${estadoAnterior}`
  };

  const updateData: any = {
    estadoActual: estadoAnterior,
    historialEstados: arrayUnion(nuevoHistorial),
    fechaUltimaActualizacion: Timestamp.now()
  };

  // Si retrocede desde desmanche, desactivarlo
  if (seguimiento.estadoActual === 'desmanche') {
    updateData['desmanche.activado'] = false;
  }

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

// ============================================
// DESPACHO (REPARTIDORES)
// ============================================

/**
 * Inicia el despacho (listo_despacho → en_despacho)
 */
export const iniciarDespacho = async (
  seguimiento: Seguimiento,
  repartidor_id: string,
  repartidorNombre: string,
  vehiculo: string,
  patente: string
): Promise<void> => {
  if (seguimiento.estadoActual !== 'listo_despacho') {
    throw new Error('El seguimiento debe estar en estado listo_despacho');
  }

  const nuevoHistorial = {
    estado: 'en_despacho' as EstadoComanda,
    fechaCambio: Timestamp.now(),
    operario_id: repartidor_id,
    operarioNombre: repartidorNombre,
    turno: null,
    comentario: 'Despacho iniciado'
  };

  const updateData = {
    estadoActual: 'en_despacho' as EstadoComanda,
    historialEstados: arrayUnion(nuevoHistorial),
    'despacho.estadoDespacho': 'en_camino',
    'despacho.repartidor_id': repartidor_id,
    'despacho.repartidorNombre': repartidorNombre,
    'despacho.vehiculo': vehiculo,
    'despacho.patente': patente,
    'despacho.horaSalida': Timestamp.now(),
    fechaUltimaActualizacion: Timestamp.now()
  };

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

/**
 * Valida el código verificador y confirma la entrega
 */
export const confirmarEntrega = async (
  seguimiento: Seguimiento,
  comanda: Comanda,
  codigoIngresado: string,
  personaQueRecibe: string,
  repartidor_id: string,
  repartidorNombre: string
): Promise<void> => {
  if (seguimiento.estadoActual !== 'en_despacho') {
    throw new Error('El seguimiento debe estar en estado en_despacho');
  }

  // Validar código
  if (codigoIngresado.toUpperCase() !== comanda.codigoDespacho.toUpperCase()) {
    throw new Error('Código verificador incorrecto');
  }

  const nuevoHistorial = {
    estado: 'entregado' as EstadoComanda,
    fechaCambio: Timestamp.now(),
    operario_id: repartidor_id,
    operarioNombre: repartidorNombre,
    turno: null,
    comentario: `Entregado a: ${personaQueRecibe}`
  };

  const updateData = {
    estadoActual: 'entregado' as EstadoComanda,
    activo: false,
    historialEstados: arrayUnion(nuevoHistorial),
    'despacho.estadoDespacho': 'entregado',
    'despacho.codigoVerificado': true,
    'despacho.personaQueRecibe': personaQueRecibe,
    'despacho.horaEntrega': Timestamp.now(),
    fechaUltimaActualizacion: Timestamp.now()
  };

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

/**
 * Reporta una incidencia en el despacho
 */
export const reportarIncidenciaDespacho = async (
  seguimiento: Seguimiento,
  tipo: TipoIncidenciaDespacho,
  descripcion: string
): Promise<void> => {
  const updateData = {
    'despacho.estadoDespacho': 'fallido',
    'despacho.incidencia.tieneIncidencia': true,
    'despacho.incidencia.tipo': tipo,
    'despacho.incidencia.descripcion': descripcion,
    'despacho.incidencia.fecha': Timestamp.now(),
    fechaUltimaActualizacion: Timestamp.now()
  };

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

// ============================================
// INCIDENCIAS GENERALES
// ============================================

/**
 * Reporta una incidencia general durante el proceso
 */
export const reportarIncidencia = async (
  seguimiento: Seguimiento,
  operario_id: string,
  operarioNombre: string,
  tipo: TipoIncidencia,
  descripcion: string
): Promise<void> => {
  const nuevaIncidencia = {
    id: `inc_${Date.now()}`,
    fecha: Timestamp.now(),
    estado: seguimiento.estadoActual,
    operario_id,
    operarioNombre,
    tipo,
    descripcion,
    resuelta: false
  };

  const updateData = {
    incidencias: arrayUnion(nuevaIncidencia),
    fechaUltimaActualizacion: Timestamp.now()
  };

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};

/**
 * Marca una incidencia como resuelta
 */
export const resolverIncidencia = async (
  seguimiento: Seguimiento,
  incidenciaId: string
): Promise<void> => {
  const incidencias = seguimiento.incidencias.map(inc => 
    inc.id === incidenciaId ? { ...inc, resuelta: true } : inc
  );

  const updateData = {
    incidencias,
    fechaUltimaActualizacion: Timestamp.now()
  };

  const seguimientoRef = doc(db, 'seguimiento_3', seguimiento.id);
  await updateDoc(seguimientoRef, updateData);
};