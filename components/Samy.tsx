/**
 * Samy, la mascota de Mundialito: la pelotita naranja del spinner, con ojos.
 * SVG inline sin estado; el parpadeo es CSS puro (`.samy-eye` en globals.css).
 * Decorativa (aria-hidden): acompaña al título, no comunica nada por sí sola.
 */
export function Samy({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="11" fill="#ff3d00" />
      <ellipse className="samy-eye" cx="8.5" cy="11" rx="1.6" ry="2.4" fill="#0a0a0b" />
      <ellipse className="samy-eye" cx="15.5" cy="11" rx="1.6" ry="2.4" fill="#0a0a0b" />
    </svg>
  );
}
