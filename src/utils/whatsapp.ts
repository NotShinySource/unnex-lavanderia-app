// src/utils/whatsapp.ts

import type { ComandaCompleta, TipoIncidencia } from '../types';

// 📱 NÚMERO DE WHATSAPP DEL EMPLEADOR
// TODO: Reemplazar con el número real cuando lo tengan
const NUMERO_EMPLEADOR = '+56912345678'; // ← CAMBIAR AQUÍ

/**
 * Genera la URL de Click to WhatsApp con mensaje pre-rellenado
 */
export const generarURLWhatsApp = (
  numeroDestino: string,
  mensaje: string
): string => {
  // Limpiar número (solo dígitos y +)
  const numeroLimpio = numeroDestino.replace(/[^\d+]/g, '');
  
  // Codificar mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje);
  
  // Retornar URL de WhatsApp Web
  return `https://wa.me/${numeroLimpio.replace('+', '')}?text=${mensajeCodificado}`;
};

/**
 * Construye el mensaje de reporte para el empleador
 */
export const construirMensajeReporte = (
  comandaCompleta: ComandaCompleta,
  tipoProblema: TipoIncidencia | 'critico',
  descripcion: string,
  operarioNombre: string
): string => {
  const { comanda, seguimiento } = comandaCompleta;
  
  // Emojis para tipos de problema
  const emojiProblema: Record<string, string> = {
    falla_equipo: '⚙️',
    falta_insumo: '📦',
    prenda_danada: '👕',
    critico: '🚨',
    otro: '⚠️'
  };

  const emoji = emojiProblema[tipoProblema] || '⚠️';
  
  // Construir mensaje formateado
  const mensaje = `
${emoji} *REPORTE DE PROBLEMA* ${emoji}

📋 *Pedido:* ${comanda.numeroOrden}
👤 *Cliente:* ${comanda.nombreCliente}
📞 *Teléfono:* ${comanda.telefono}

🔧 *Estado Actual:* ${seguimiento.estadoActual.replace('_', ' ').toUpperCase()}
👷 *Reportado por:* ${operarioNombre}

❗ *Tipo de Problema:*
${formatearTipoProblema(tipoProblema)}

📝 *Descripción:*
${descripcion}

⏰ *Fecha:* ${new Date().toLocaleString('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

---
_Lavandería El Cobre SPA - Sistema de Gestión_
`.trim();

  return mensaje;
};

/**
 * Formatea el tipo de problema para mostrar
 */
const formatearTipoProblema = (tipo: TipoIncidencia | 'critico'): string => {
  const tipos: Record<string, string> = {
    falla_equipo: 'Falla en Equipo',
    falta_insumo: 'Falta de Insumo',
    prenda_danada: 'Prenda Dañada',
    critico: 'Problema Crítico - Requiere Atención Inmediata',
    otro: 'Otro'
  };
  
  return tipos[tipo] || 'No especificado';
};

/**
 * Abre WhatsApp con el mensaje de reporte
 */
export const enviarReporteWhatsApp = (
  comandaCompleta: ComandaCompleta,
  tipoProblema: TipoIncidencia | 'critico',
  descripcion: string,
  operarioNombre: string
): void => {
  const mensaje = construirMensajeReporte(
    comandaCompleta,
    tipoProblema,
    descripcion,
    operarioNombre
  );
  
  const url = generarURLWhatsApp(NUMERO_EMPLEADOR, mensaje);
  
  // Abrir en nueva pestaña
  window.open(url, '_blank');
};