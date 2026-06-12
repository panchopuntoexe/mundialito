"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Form para crear una liga (tarea 6.6). POST /api/leagues y, al crearse, navega
 * a la pantalla de la liga (donde está el código para compartir). El servidor
 * re-valida el nombre y genera el invite_code.
 */
export function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Ponle un nombre a la liga.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data: { league?: { id: string }; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.status === 201 && data.league) {
        router.push(`/leagues/${data.league.id}`);
        router.refresh();
        return;
      }
      setError(data.error ?? "No se pudo crear la liga.");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label
        htmlFor="league-name"
        className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted"
      >
        Crear una liga
      </label>
      <div className="flex gap-2">
        <input
          id="league-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Nombre de la liga"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm outline-none placeholder:text-foreground-muted focus:border-brand"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
        >
          {submitting ? "Creando…" : "Crear"}
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
