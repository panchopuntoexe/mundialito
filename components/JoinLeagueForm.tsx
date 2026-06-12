"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Form para unirse a una liga por código (tarea 6.6). POST /api/leagues/join y,
 * al unirse, navega a la liga. El código se normaliza a mayúsculas server-side,
 * así que da igual cómo lo escriba el usuario.
 */
export function JoinLeagueForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Ingresa el código de invitación.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code }),
      });
      const data: { league?: { id: string }; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.league) {
        router.push(`/leagues/${data.league.id}`);
        router.refresh();
        return;
      }
      setError(data.error ?? "No se pudo unir a la liga.");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label
        htmlFor="invite-code"
        className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted"
      >
        Unirse con un código
      </label>
      <div className="flex gap-2">
        <input
          id="invite-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Ej: K7Qma9"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm uppercase tracking-widest outline-none placeholder:tracking-normal placeholder:text-foreground-muted focus:border-brand"
        />
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted disabled:opacity-50"
        >
          {submitting ? "Uniéndote…" : "Unirme"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
