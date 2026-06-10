/**
 * URL/host público de la app, centralizado.
 *
 * Se usa en la tarjeta compartible (texto del footer + destino del QR). Antes
 * estaba hardcodeado en `lib/wrapped/card.tsx`. Si algún día se mueve a un dominio
 * propio, se cambia acá una sola vez.
 */
export const APP_HOST = "mundialito26-six.vercel.app";
export const APP_URL = `https://${APP_HOST}`;
