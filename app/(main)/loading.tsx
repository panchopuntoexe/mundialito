import { Loader } from "@/components/Loader";

/**
 * Fallback de Suspense del grupo (main). Es el boundary más cercano de Hoy,
 * Ligas y Estadísticas: al cambiar de sección muestra el spinner en el área de
 * contenido mientras el Server Component carga, sin desmontar header + nav.
 */
export default function MainLoading() {
  return <Loader />;
}
