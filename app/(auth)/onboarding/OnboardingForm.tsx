"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usernameSchema } from "@/lib/validations/user";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Formulario de onboarding (tarea 2.3). Valida el formato del username en el
 * cliente (mismo schema Zod que el server), chequea disponibilidad con debounce
 * contra GET /api/users, y crea el perfil con POST. La autoridad de unicidad es
 * el servidor: el chequeo en vivo es solo UX.
 */
export function OnboardingForm({
  initialUsername,
}: {
  initialUsername: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  // Resultado del último chequeo de disponibilidad resuelto en el server.
  const [check, setCheck] = useState<{ name: string; available: boolean } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = usernameSchema.safeParse(username);
  const formatError = !parsed.success
    ? (parsed.error.issues[0]?.message ?? "Username inválido.")
    : null;

  // Estado de disponibilidad DERIVADO (no se guarda en estado para evitar
  // cascadas de render): se calcula del formato + el último chequeo del server.
  let availability: Availability;
  if (username.length === 0) availability = "idle";
  else if (!parsed.success) availability = "invalid";
  else if (check && check.name === parsed.data)
    availability = check.available ? "available" : "taken";
  else availability = "checking";

  // Chequeo de disponibilidad con debounce (solo si el formato es válido).
  // El setState vive dentro del callback async, no en el cuerpo del effect.
  useEffect(() => {
    const result = usernameSchema.safeParse(username);
    if (!result.success) return;
    const name = result.data;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users?username=${encodeURIComponent(name)}`,
          { signal: controller.signal },
        );
        const data: { available: boolean } = await res.json();
        setCheck({ name, available: data.available });
      } catch {
        // Abortado por un nuevo tecleo: ignorar.
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parsed.success) {
      setError(formatError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: parsed.data }),
      });
      if (res.status === 201) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el perfil.");
      if (res.status === 409) setCheck({ name: parsed.data, available: false });
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = parsed.success && availability !== "taken" && !submitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center rounded-lg border border-border bg-surface-muted focus-within:border-brand">
          <span className="pl-3 text-sm text-foreground-muted">@</span>
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            placeholder="tu_username"
            aria-invalid={availability === "taken" || availability === "invalid"}
            className="w-full bg-transparent px-1.5 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-muted"
          />
          <span className="pr-3 text-xs">
            {availability === "checking" && (
              <span className="text-foreground-muted">…</span>
            )}
            {availability === "available" && (
              <span className="text-brand">disponible ✓</span>
            )}
            {availability === "taken" && (
              <span className="text-danger">en uso</span>
            )}
          </span>
        </div>
        {username.length > 0 && formatError && (
          <p className="text-xs text-danger">{formatError}</p>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
      >
        {submitting ? "Creando…" : "Empezar a jugar"}
      </button>
    </form>
  );
}
