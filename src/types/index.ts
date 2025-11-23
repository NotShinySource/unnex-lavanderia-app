import type { IconType } from 'react-icons';
import { 
  BsClipboardCheck, 
  BsDroplet, 
  BsWind,
  BsBox,
  BsCheckCircle,
  BsBoxSeam,
  BsTruck,
  BsCheckCircleFill
} from 'react-icons/bs';
import {
  TbShirt,
  TbBottle
} from 'react-icons/tb';

// ============================================
// TIPOS DE USUARIO
// ============================================
export type RolUsuario = 'administrador' | 'operario' | 'repartidor';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  uid: string;
  telefono?: string;
  fecha_creacion: Date;
  ultimo_acceso: Date;
  activo: boolean;
}

// ============================================
// TIPOS DE COMANDA (Solo lectura - Grupo 2)
// ============================================
export type TipoCliente = 'particular' | 'hotel' | 'institucion' | 'empresa';
export type TipoEntrega = 'retiro' | 'despacho';

export interface PrendaComanda {
  nombre: string;        // Tipo de prenda
  cantidad: number;
  detalle: string;
  valor: string;
}

export interface Comanda {
  id: string;
  
  // Identificación
  numeroOrden: string;           // Código de seguimiento
  codigoDespacho: string;     // Código de 5 caracteres para validación
  numeroBoucher: string;
  
  // Cliente
  nombreCliente: string;
  telefono: string;
  tipoCliente: TipoCliente;
  direccion?: string;            // Solo si tipoEntrega = 'despacho'
  
  // Fechas
  fechaIngreso: Date;
  horaIngreso: string;
  fechaNotificacion?: Date;
  
  // Prendas
  prendas: PrendaComanda[];
  
  // Precios
  montoSubtotal: number;
  montoTotal: number;
  
  // Servicio
  tipoEntrega: TipoEntrega;
  servicioExpress: boolean;
  
  // Estado notificación (manejado por Grupo 2)
  notificado: boolean;
}

// ============================================
// TIPOS DE SEGUIMIENTO (Lectura/Escritura - Grupo 1)
// ============================================
export type EstadoComanda = 
  | 'pendiente'
  | 'lavando'
  | 'secando'
  | 'planchando'
  | 'desmanche'
  | 'empaquetado'
  | 'listo_retiro'
  | 'listo_despacho'
  | 'en_despacho'
  | 'entregado';

export type Turno = 'A' | 'B';
export type EstadoDespacho = 'pendiente' | 'en_camino' | 'entregado' | 'fallido';
export type TipoIncidencia = 'falla_equipo' | 'falta_insumo' | 'prenda_danada' | 'otro';
export type TipoIncidenciaDespacho = 'cliente_ausente' | 'direccion_incorrecta' | 'falla_vehiculo' | 'otro';

export interface OperarioAsignado {
  id: string;
  nombre: string;
}

export interface OperariosPorProceso {
  turno: Turno;
  operarios: OperarioAsignado[];
}

export interface HistorialEstado {
  estado: EstadoComanda;
  fechaCambio: Date;
  operario_id: string;
  operarioNombre: string;
  turno?: Turno | null;
  comentario: string;
}

export interface Desmanche {
  activado: boolean;
  veces: number;
  ultimaFecha?: Date | null;
  operario_id?: string | null;
  operarioNombre?: string | null;
}

export interface IncidenciaDespacho {
  tieneIncidencia: boolean;
  tipo: TipoIncidenciaDespacho | null;
  descripcion: string | null;
  fecha: Date | null;
}

export interface Despacho {
  estadoDespacho: EstadoDespacho;
  repartidor_id: string | null;
  repartidorNombre: string | null;
  vehiculo: string | null;
  patente: string | null;
  horaSalida: Date | null;
  horaEntrega: Date | null;
  codigoVerificado: boolean;
  personaQueRecibe: string | null;
  incidencia: IncidenciaDespacho;
}

export interface Incidencia {
  id: string;
  fecha: Date;
  estado: EstadoComanda;
  operario_id: string;
  operarioNombre: string;
  tipo: TipoIncidencia;
  descripcion: string;
  resuelta: boolean;
}

export interface Seguimiento {
  id: string;                    // Mismo ID que la comanda
  comanda_id: string;
  numeroOrden: string;           // Duplicado para búsquedas rápidas
  
  estadoActual: EstadoComanda;
  turnoActual: Turno | null;
  activo: boolean;
  
  historialEstados: HistorialEstado[];
  operariosAsignados: Record<string, OperariosPorProceso>;
  
  desmanche: Desmanche;
  despacho?: Despacho;
  incidencias: Incidencia[];
  
  fechaCreacion: Date;
  fechaUltimaActualizacion: Date;
}

// ============================================
// TIPO COMBINADO (Para uso en componentes)
// ============================================
export interface ComandaCompleta {
  comanda: Comanda;
  seguimiento: Seguimiento;
}

// ============================================
// CONFIGURACIÓN DE ESTADOS (UI)
// ============================================
export const ESTADOS_CONFIG: Record<EstadoComanda, {
  label: string;
  color: string;
  bgColor: string;
  icon: IconType;
}> = {
  pendiente: {
    label: 'Procesos Pendientes',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: BsClipboardCheck
  },
  lavando: {
    label: 'Procesos en Lavado',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: BsDroplet
  },
  secando: {
    label: 'Procesos en Secado',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: BsWind
  },
  planchando: {
    label: 'Procesos en Planchado',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: TbShirt
  },
  desmanche: {
    label: 'Procesos en Desmanche',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: TbBottle
  },
  empaquetado: {
    label: 'Procesos en Empaquetado',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: BsBox
  },
  listo_retiro: {
    label: 'Listo para Retiro',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: BsCheckCircle
  },
  listo_despacho: {
    label: 'Preparando Despacho',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    icon: BsBoxSeam
  },
  en_despacho: {
    label: 'En Despacho',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    icon: BsTruck
  },
  entregado: {
    label: 'Entregado',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    icon: BsCheckCircleFill
  }
};

// Estados que muestran turno y operarios
export const ESTADOS_CON_OPERARIOS: EstadoComanda[] = [
  'lavando',
  'secando', 
  'planchando',
  'desmanche',
  'empaquetado'
];

// ============================================
// PLANTILLAS DE INCIDENCIAS
// ============================================
export const PLANTILLAS_INCIDENCIAS_OPERARIO = [
  {
    tipo: 'falla_equipo' as TipoIncidencia,
    titulo: 'Falla en Equipo',
    descripcion: 'Equipo de [ESPECIFICAR] presenta falla técnica'
  },
  {
    tipo: 'falta_insumo' as TipoIncidencia,
    titulo: 'Falta de Insumo',
    descripcion: 'No hay suficiente [ESPECIFICAR INSUMO] para continuar'
  },
  {
    tipo: 'prenda_danada' as TipoIncidencia,
    titulo: 'Prenda Dañada',
    descripcion: 'Prenda presenta daño: [ESPECIFICAR]'
  },
  {
    tipo: 'otro' as TipoIncidencia,
    titulo: 'Otro',
    descripcion: ''
  }
];

export const PLANTILLAS_INCIDENCIAS_DESPACHO = [
  {
    tipo: 'cliente_ausente' as TipoIncidenciaDespacho,
    titulo: 'Cliente Ausente',
    descripcion: 'Cliente no se encuentra en el domicilio'
  },
  {
    tipo: 'direccion_incorrecta' as TipoIncidenciaDespacho,
    titulo: 'Dirección Incorrecta',
    descripcion: 'La dirección proporcionada es incorrecta o no existe'
  },
  {
    tipo: 'falla_vehiculo' as TipoIncidenciaDespacho,
    titulo: 'Falla en Vehículo',
    descripcion: 'El vehículo presenta una falla mecánica'
  },
  {
    tipo: 'otro' as TipoIncidenciaDespacho,
    titulo: 'Otro',
    descripcion: ''
  }
];

// ============================================
// FORMULARIOS
// ============================================
export interface LoginFormData {
  email: string;
  password: string;
}

export interface AvanzarEstadoParams {
  seguimiento: Seguimiento;
  operario_id: string;
  operarioNombre: string;
  turno?: Turno;
  operariosAsignados?: OperarioAsignado[];
}

export interface IniciarDespachoParams {
  seguimiento: Seguimiento;
  repartidor_id: string;
  repartidorNombre: string;
  vehiculo: string;
  patente: string;
}

export interface ValidarCodigoParams {
  seguimiento: Seguimiento;
  codigoIngresado: string;
  personaQueRecibe: string;
}

export interface ReportarIncidenciaParams {
  seguimiento: Seguimiento;
  operario_id: string;
  operarioNombre: string;
  tipo: TipoIncidencia | TipoIncidenciaDespacho;
  descripcion: string;
}