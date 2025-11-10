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
} from 'react-icons/tb'

// ============================================
// TIPOS DE USUARIO
// ============================================
export type RolUsuario = 'administrador' | 'empleado' | 'cliente' | 'repartidor';


export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  fechaRegistro: Date;
  activo?: boolean;
  telefono?: string;
}

// ============================================
// TIPOS DE COMANDA
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

export type TipoCliente = 'particular' | 'hotel' | 'institucion' | 'empresa';
export type TipoEntrega = 'retiro' | 'despacho';
export type Turno = 'A' | 'B';

export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  email?: string;
  tipo: TipoCliente;
}

export interface DetallePrenda {
  tipo: string;
  cantidad: number;
}

export interface EmpleadoAsignado {
  id: string;
  nombre: string;
}

export interface EmpleadosPorProceso {
  turno: Turno;
  empleados: EmpleadoAsignado[];
}

export interface HistorialEstado {
  estado: EstadoComanda;
  fechaCambio: Date;
  empleado_id: string;
  empleadoNombre: string;
  turno?: Turno | null;
  comentario?: string;
}

export interface Desmanche {
  activado: boolean;
  veces: number;
  ultimaFecha?: Date;
  empleado_id?: string;
  empleadoNombre?: string;
}

export interface Notificacion {
  enviado: boolean;
  fecha?: Date;
}

export interface Notificaciones {
  inicioProceso: Notificacion;
  listoRetiro: Notificacion;
  inicioDespacho?: Notificacion;
}

export interface Despacho {
  direccion: string;
  repartidor_id?: string;
  repartidorNombre?: string;
  vehiculo?: string;
  patente?: string;
  estadoDespacho: 'pendiente' | 'en_camino' | 'entregado';
  horaSalida?: Date;
  horaEntrega?: Date;
}

export interface Incidencia {
  fecha: Date;
  estado: EstadoComanda;
  empleado_id: string;
  empleadoNombre: string;
  tipo: 'falla_equipo' | 'falta_insumo' | 'prenda_dañada' | 'otro';
  descripcion: string;
  notificadoCliente: boolean;
}

export interface Comanda {
  id: string;
  codigoSeguimiento: string;
  fechaIngreso: Date;
  fechaRetiroLimite: Date;
  
  cliente: Cliente;
  
  estadoActual: EstadoComanda;
  turnoActual?: Turno | null;
  tipoEntrega: TipoEntrega;
  
  detallesPrenda: DetallePrenda[];
  precioTotal: number;
  observaciones?: string;
  
  historialEstados: HistorialEstado[];
  empleadosAsignados: Record<string, EmpleadosPorProceso>;
  
  despacho?: Despacho;
  incidencias: Incidencia[];
  desmanche: Desmanche;
  notificaciones: Notificaciones;
  
  activo: boolean;
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
    label: 'Listo para Despacho',
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

// Estados que muestran turno y empleados
export const ESTADOS_CON_EMPLEADOS: EstadoComanda[] = [
  'lavando',
  'secando', 
  'planchando',
  'desmanche',
  'empaquetado'
];

// ============================================
// FORMULARIOS
// ============================================
export interface LoginFormData {
  email: string;
  password: string;
}