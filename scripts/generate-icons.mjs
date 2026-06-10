/**
 * Generador de iconos PWA (tarea 8.1).
 *
 * Produce los PNG del manifest y de iOS SIN dependencias externas: encoder PNG
 * propio (zlib de Node + CRC32). Dibuja el icono de marca — un "objetivo/pelota"
 * blanco sobre el verde cancha — en los tamaños que exige la instalabilidad
 * (192, 512), la variante maskable y el apple-touch-icon (180).
 *
 * Re-correr regenera los archivos de forma determinista:
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// Paleta de marca (coincide con app/globals.css).
const BRAND = [0x16, 0xa3, 0x4a]; // verde cancha (brand-strong)
const WHITE = [0xff, 0xff, 0xff];

// ── Encoder PNG mínimo (RGBA, 8 bits, sin interlace) ─────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Cada scanline con byte de filtro 0 (None) al inicio.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Dibujo del icono ─────────────────────────────────────────────
/** Cobertura suave (antialias) de un borde: 1 dentro, 0 fuera, rampa de ~1.5px. */
function edgeCoverage(dist, edge) {
  const w = 1.5;
  if (dist <= edge - w) return 1;
  if (dist >= edge + w) return 0;
  return (edge + w - dist) / (2 * w);
}

function blend(base, fg, cov) {
  return [
    Math.round(base[0] * (1 - cov) + fg[0] * cov),
    Math.round(base[1] * (1 - cov) + fg[1] * cov),
    Math.round(base[2] * (1 - cov) + fg[2] * cov),
  ];
}

/**
 * Renderiza el icono.
 * @param {number} size
 * @param {boolean} maskable  true = full-bleed (sin esquinas redondeadas), para
 *   maskable y apple-touch (iOS aplica su propia máscara). false = esquinas
 *   redondeadas con fondo transparente afuera.
 */
function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  // Geometría del "objetivo/pelota": anillo blanco + punto central.
  // En maskable el dibujo vive dentro del safe zone (~80%), así que se achica.
  const scale = maskable ? 0.8 : 1;
  const rOuter = size * 0.34 * scale;
  const rInner = size * 0.22 * scale;
  const rDot = size * 0.1 * scale;

  // Esquinas redondeadas (solo no-maskable).
  const corner = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Alpha de la silueta (rounded rect) — full opaco en maskable.
      let shapeCov = 1;
      if (!maskable) {
        // Distancia al rectángulo redondeado para recortar esquinas.
        const dx = Math.max(corner - x, x - (size - 1 - corner), 0);
        const dy = Math.max(corner - y, y - (size - 1 - corner), 0);
        const cornerDist = Math.sqrt(dx * dx + dy * dy);
        shapeCov = edgeCoverage(cornerDist, corner);
      }

      if (shapeCov <= 0) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
        continue;
      }

      let color = BRAND;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      // Anillo blanco: entre rInner y rOuter.
      const ringCov = edgeCoverage(d, rOuter) * (1 - edgeCoverage(d, rInner));
      // Punto central blanco.
      const dotCov = edgeCoverage(d, rDot);
      const whiteCov = Math.max(ringCov, dotCov);
      if (whiteCov > 0) color = blend(BRAND, WHITE, whiteCov);

      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = Math.round(255 * shapeCov);
    }
  }

  return encodePng(size, size, rgba);
}

// ── Salida ───────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ["icon-192.png", drawIcon(192, false)],
  ["icon-512.png", drawIcon(512, false)],
  ["maskable-512.png", drawIcon(512, true)],
  ["apple-touch-icon.png", drawIcon(180, true)],
];

for (const [name, buf] of files) {
  writeFileSync(join(OUT_DIR, name), buf);
  console.log(`✓ public/icons/${name} (${buf.length} bytes)`);
}
