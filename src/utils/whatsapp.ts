/**
 * Abre WhatsApp Web con un mensaje predefinido
 */
export const enviarWhatsApp = (telefono: string, mensaje: string) => {
  // Limpiar el número (quitar espacios, guiones, etc.)
  const numeroLimpio = telefono.replace(/[^\d+]/g, '');
  
  // Codificar el mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje);
  
  // Construir URL de WhatsApp
  const url = `https://wa.me/${numeroLimpio}?text=${mensajeCodificado}`;
  
  // Abrir en nueva pestaña
  window.open(url, '_blank');
};

/**
 * Genera mensaje de inicio de proceso
 */
export const mensajeInicioProceso = (codigoSeguimiento: string) => {
  return `¡Hola!

Tu pedido ha sido recibido en Lavandería El Cobre y ya se esta procesando.

*Código de seguimiento:* ${codigoSeguimiento}

https://lavanderia-el-cobre-spa.vercel.app

Puedes hacer seguimiento de tu pedido en cualquier momento ingresando tu código en nuestra página web.

¡Gracias por confiar en nosotros!`;
};

/**
 * Genera mensaje de listo para retiro
 */
export const mensajeListoRetiro = (codigoSeguimiento: string, fechaLimite: Date) => {
  const fechaFormateada = fechaLimite.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `¡Buenas noticias!

Tu pedido *${codigoSeguimiento}* está listo para retiro en Lavandería El Cobre.

*Fecha límite de retiro:* ${fechaFormateada}

Recuerda traer tu comprobante. ¡Te esperamos!`;
};

/**
 * Genera mensaje de inicio de despacho
 */
export const mensajeInicioDespacho = (
  codigoSeguimiento: string,
  repartidor: string,
  vehiculo: string,
  patente: string
) => {
  return `¡Tu pedido va en camino!

*Código:* ${codigoSeguimiento}

*Repartidor:* ${repartidor}
*Vehículo:* ${vehiculo}
*Patente:* ${patente}

El repartidor llegará pronto a tu domicilio. ¡Gracias por tu preferencia!`;
};