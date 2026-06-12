"use client";

import { useState } from "react";
import { FaXmark } from "react-icons/fa6";
import { createClient } from "@/lib/supabase/client";

/**
 * Pill del header para invitados (modo "Jugar sin cuenta"): vincula la sesión
 * anónima con Google vía linkIdentity (requiere manual linking habilitado en
 * Supabase). El retorno pasa por /callback con el MISMO user.id: username,
 * puntos y rachas quedan intactos; is_anonymous pasa a false y la pill
 * desaparece en el próximo render del layout.
 */
export function SaveAccountButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
    if (error) {
      setMessage(
        /already linked|identity_already_exists/i.test(error.message)
          ? "Esa cuenta de Google ya tiene un perfil en Mundialito. Cierra sesión y entra con Google."
          : "No pudimos vincular tu cuenta. Intenta de nuevo.",
      );
      setBusy(false);
      return;
    }
    if (data.url) {
      window.location.assign(data.url);
      return;
    }
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        title="Guarda tu progreso con Google para no perderlo"
        className="rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand transition hover:bg-brand/20 disabled:opacity-50"
      >
        {busy ? "Vinculando…" : "Guardar cuenta"}
      </button>
      {message && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-20 flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-muted p-4 text-sm shadow-lg"
        >
          <p>{message}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Cerrar"
            className="shrink-0 text-foreground-muted transition hover:text-foreground"
          >
            <FaXmark aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
