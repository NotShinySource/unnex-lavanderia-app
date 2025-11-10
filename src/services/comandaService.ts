import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { EstadoComanda, Turno, EmpleadoAsignado, Comanda } from '../types';
import { 
  enviarWhatsApp, 
  mensajeInicioProceso, 
  mensajeListoRetiro,
  mensajeInicioDespacho 
} from '../utils/whatsapp';

// Mapeo de flujo de estados
const SIGUIENTE_ESTADO: Record<EstadoComanda, EstadoComanda | null> = {
  pendiente: 'lavando',
  lavando: 'secando',
  secando: 'planchando',
  planchando: 'empaquetado',
  desmanche: 'lavando', // Vuelve a lavado después de desmanche
  empaquetado: null, // Se decide entre listo_retiro o listo_despacho
  listo_retiro: 'entregado',
  listo_despacho: 'en_despacho',
  en_despacho: 'entregado',
  entregado: null
};

interface AvanzarEstadoParams {
  comanda: Comanda;
  empleado_id: string;
  empleadoNombre: string;
  turno?: Turno;
  empleadosAsignados?: EmpleadoAsignado[];
  repartidor?: {
    id: string;
    nombre: string;
    vehiculo: string;
    patente: string;
  };
}

/**
 * Avanza una comanda al siguiente estado
 */
export const avanzarEstado = async ({
  comanda,
  empleado_id,
  empleadoNombre,
  turno,
  empleadosAsignados = [],
  repartidor
}: AvanzarEstadoParams): Promise<void> => {
  const estadoActual = comanda.estadoActual;
  let siguienteEstado = SIGUIENTE_ESTADO[estadoActual];

  // Caso especial: empaquetado debe decidir entre retiro o despacho
  if (estadoActual === 'empaquetado') {
    siguienteEstado = comanda.tipoEntrega === 'retiro' ? 'listo_retiro' : 'listo_despacho';
  }

  if (!siguienteEstado) {
    throw new Error('No hay siguiente estado disponible');
  }

  // Preparar actualización del historial
  const nuevoHistorial = {
    estado: siguienteEstado,
    fechaCambio: Timestamp.now(),
    empleado_id,
    empleadoNombre,
    turno: turno || null,
    comentario: `Avanzó de ${estadoActual} a ${siguienteEstado}`
  };

  // Preparar datos de actualización
  const updateData: any = {
    estadoActual: siguienteEstado,
    historialEstados: arrayUnion(nuevoHistorial)
  };

  // Si se proporciona turno, actualizarlo
  if (turno) {
    updateData.turnoActual = turno;
  }

  // Si hay empleados asignados, guardarlos
  // IMPORTANTE: Asignar empleados cuando avanza de pendiente a lavando
  if (empleadosAsignados.length > 0 && turno) {
    updateData[`empleadosAsignados.${siguienteEstado}`] = {
      turno,
      empleados: empleadosAsignados
    };
  }

  // Actualizar notificaciones según el estado
  if (siguienteEstado === 'lavando' && estadoActual === 'pendiente') {
    // Primera vez que avanza de pendiente a lavando
    updateData['notificaciones.inicioProceso.enviado'] = true;
    updateData['notificaciones.inicioProceso.fecha'] = Timestamp.now();
  }

  if (siguienteEstado === 'listo_retiro') {
    updateData['notificaciones.listoRetiro.enviado'] = true;
    updateData['notificaciones.listoRetiro.fecha'] = Timestamp.now();
  }

  if (siguienteEstado === 'en_despacho') {
    if (!repartidor) {
      throw new Error('Se requiere información del repartidor para despacho');
    }
    
    updateData['despacho.repartidor_id'] = repartidor.id;
    updateData['despacho.repartidorNombre'] = repartidor.nombre;
    updateData['despacho.vehiculo'] = repartidor.vehiculo;
    updateData['despacho.patente'] = repartidor.patente;
    updateData['despacho.estadoDespacho'] = 'en_camino';
    updateData['despacho.horaSalida'] = Timestamp.now();
    updateData['notificaciones.inicioDespacho.enviado'] = true;
    updateData['notificaciones.inicioDespacho.fecha'] = Timestamp.now();
  }

  // Actualizar en Firestore
  const comandaRef = doc(db, 'comandas', comanda.id);
  await updateDoc(comandaRef, updateData);

  // Enviar notificación por WhatsApp si corresponde
  if (siguienteEstado === 'lavando' && estadoActual === 'pendiente') {
    const mensaje = mensajeInicioProceso(comanda.codigoSeguimiento);
    enviarWhatsApp(comanda.cliente.telefono, mensaje);
  }

  if (siguienteEstado === 'listo_retiro') {
    const mensaje = mensajeListoRetiro(comanda.codigoSeguimiento, comanda.fechaRetiroLimite);
    enviarWhatsApp(comanda.cliente.telefono, mensaje);
  }

  if (siguienteEstado === 'en_despacho' && repartidor) {
    const mensaje = mensajeInicioDespacho(
      comanda.codigoSeguimiento,
      repartidor.nombre,
      repartidor.vehiculo,
      repartidor.patente
    );
    enviarWhatsApp(comanda.cliente.telefono, mensaje);
  }
};

/**
 * Activa el proceso de desmanche
 */
export const activarDesmanche = async (
  comanda: Comanda,
  empleado_id: string,
  empleadoNombre: string
): Promise<void> => {
  const nuevoHistorial = {
    estado: 'desmanche' as EstadoComanda,
    fechaCambio: Timestamp.now(),
    empleado_id,
    empleadoNombre,
    turno: comanda.turnoActual,
    comentario: 'Iniciado proceso de desmanche'
  };

  const updateData = {
    estadoActual: 'desmanche' as EstadoComanda,
    historialEstados: arrayUnion(nuevoHistorial),
    'desmanche.activado': true,
    'desmanche.veces': (comanda.desmanche.veces || 0) + 1,
    'desmanche.ultimaFecha': Timestamp.now(),
    'desmanche.empleado_id': empleado_id,
    'desmanche.empleadoNombre': empleadoNombre
  };

  const comandaRef = doc(db, 'comandas', comanda.id);
  await updateDoc(comandaRef, updateData);
};

/**
 * Retrocede una comanda al estado anterior
 */
export const retrocederEstado = async (
  comanda: Comanda,
  empleado_id: string,
  empleadoNombre: string
): Promise<void> => {
  // Obtener el penúltimo estado del historial
  if (comanda.historialEstados.length < 2) {
    throw new Error('No hay estado anterior al cual retroceder');
  }

  const estadoAnterior = comanda.historialEstados[comanda.historialEstados.length - 2].estado;

  const nuevoHistorial = {
    estado: estadoAnterior,
    fechaCambio: Timestamp.now(),
    empleado_id,
    empleadoNombre,
    turno: comanda.turnoActual,
    comentario: `Retrocedió de ${comanda.estadoActual} a ${estadoAnterior}`
  };

  const updateData: any = {
    estadoActual: estadoAnterior,
    historialEstados: arrayUnion(nuevoHistorial)
  };

  // Si retrocede desde desmanche, desactivarlo
  if (comanda.estadoActual === 'desmanche') {
    updateData['desmanche.activado'] = false;
  }

  const comandaRef = doc(db, 'comandas', comanda.id);
  await updateDoc(comandaRef, updateData);
};