/**
 * Spinner centrado para feedback de carga. La animación CSS vive en globals.css
 * (`.loader`). Lo usan los loading.tsx (Suspense de App Router) durante el cambio
 * de sección, mientras el header + nav siguen montados.
 */
export function Loader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <span className="loader" role="status" aria-label="Cargando" />
    </div>
  );
}
