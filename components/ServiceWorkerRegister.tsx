"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker (tarea 8.2).
 *
 * Isla de cliente sin UI: se monta en el root layout y registra `/sw.js` tras la
 * carga, en scope raíz ("/") para que controle toda la app. Solo en producción y
 * si el navegador soporta SW (evita ruido en dev con HMR).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        console.error("[sw] registro falló:", err);
      });
    };

    // Registrar tras 'load' para no competir con el render inicial.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
