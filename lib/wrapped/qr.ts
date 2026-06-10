/**
 * Generación del QR para la tarjeta Wrapped.
 *
 * `QRCode.toDataURL` produce un PNG en data-URI (JS puro, sin canvas nativo) que
 * Satori embebe vía `<img>`. La URL destino es constante, así que cacheamos la
 * promesa por URL a nivel de módulo: el QR se calcula una sola vez por proceso.
 */
import QRCode from "qrcode";

const cache = new Map<string, Promise<string>>();

/** Data-URI PNG del QR que apunta a `url` (cacheado por proceso). */
export function qrDataUrl(url: string): Promise<string> {
  let cached = cache.get(url);
  if (!cached) {
    cached = QRCode.toDataURL(url, {
      margin: 1,
      width: 300,
      color: { dark: "#0a0a0b", light: "#ffffff" },
    });
    cache.set(url, cached);
  }
  return cached;
}
