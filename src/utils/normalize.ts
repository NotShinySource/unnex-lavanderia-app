import type { TipoCliente, TipoEntrega } from '../types';

/**
 * Normaliza el tipo de cliente de comandas_2 a nuestro formato
 * Convierte: "Particular" → "particular"
 */
export const normalizarTipoCliente = (tipo: string): TipoCliente => {
  const normalized = tipo.toLowerCase();
  
  // Mapeo de posibles valores
  const mapping: Record<string, TipoCliente> = {
    'particular': 'particular',
    'hotel': 'hotel',
    'institucion': 'institucion',
    'institución': 'institucion', // Por si tiene tilde
    'empresa': 'empresa'
  };
  
  return mapping[normalized] || 'particular';
};

/**
 * Normaliza el tipo de entrega de comandas_2 a nuestro formato
 * Convierte: "Retiro" → "retiro", "Despacho" → "despacho"
 */
export const normalizarTipoEntrega = (tipo: string): TipoEntrega => {
  const normalized = tipo.toLowerCase();
  
  if (normalized === 'despacho') return 'despacho';
  if (normalized === 'retiro') return 'retiro';
  
  // Por defecto retiro
  return 'retiro';
};

/**
 * Normaliza el estado de la comanda
 * Convierte: "Activa" → true, "Inactiva" → false
 */
export const normalizarEstadoComanda = (estado?: string): boolean => {
  if (!estado) return true;
  return estado.toLowerCase() === 'activa';
};

/**
 * Genera un código verificador aleatorio de 5 caracteres alfanuméricos
 * Si la comanda no tiene codigoVerificador, se genera uno temporal
 */
export const generarCodigoVerificador = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let codigo = '';
  for (let i = 0; i < 5; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
};

/**
 * Normaliza el formato de teléfono
 * Asegura que tenga el formato +56XXXXXXXXX
 */
export const normalizarTelefono = (telefono: string): string => {
  // Eliminar espacios y caracteres especiales excepto +
  let cleaned = telefono.replace(/[^\d+]/g, '');
  
  // Si no empieza con +, agregar +56
  if (!cleaned.startsWith('+')) {
    // Si empieza con 56, agregar +
    if (cleaned.startsWith('56')) {
      cleaned = '+' + cleaned;
    } 
    // Si empieza con 9, agregar +56
    else if (cleaned.startsWith('9')) {
      cleaned = '+56' + cleaned;
    }
    // Si no, asumir que falta el código de país
    else {
      cleaned = '+56' + cleaned;
    }
  }
  
  return cleaned;
};