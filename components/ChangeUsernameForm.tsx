"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chosenUsernameSchema } from "@/lib/validations/user";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Cambio de username (una sola vez) — pensado para el invitado que guardó su
 * cuenta y sigue con el `invitado_xxxxxx` auto-generado, pero disponible para
 * cualquier cuenta guardada que todavía no lo usó.
 *
 * Mismo patrón que OnboardingForm: formato con Zod en el cliente, chequeo de
 * disponibilidad con debounce contra GET /api/users, y PATCH al confirmar. La
 * autoridad ("solo una vez", unicidad) es del servidor + trigger de la DB.
 */
export function ChangeUsernameForm({
  currentUsername,
}: {
  currentUsername: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<{ name: string; available: boolean } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const parsed = chosenUsernameSchema.safeParse(username);
  const formatError = !parsed.success
    ? (parsed.error.issues[0]?.message ?? "Username inválido.")
    : null;
  const sameAsCurrent = parsed.success && parsed.data === currentUsername;

  let availability: Availability;
  if (username.length === 0) availability = "idle";
  else if (!parsed.success || sameAsCurrent) availability = "invalid";
  else if (check && check.name === parsed.data)
    availability = check.available ? "available" : "taken";
  else availability = "checking";

  useEffect(() => {
    const result = chosenUsernameSchema.safeParse(username);
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: parsed.data }),
      });
      if (res.ok) {
        setDone(parsed.data);
        router.refresh();
        return;
      }
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cambiar el username.");
      if (res.status === 409) setCheck({ name: parsed.data, available: false });
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand">
        ¡Listo! Ahora eres <span className="font-semibold">@{done}</span>.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs font-medium text-foreground-muted underline-offset-2 transition hover:text-foreground hover:underline"
      >
        Cambiar mi nombre de usuario →
      </button>
    );
  }

  const canSubmit =
    parsed.success && !sameAsCurrent && availability === "available" && !submitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-xs text-foreground-muted">
        Elige con cuidado: el nombre de usuario se puede cambiar{" "}
        <span className="font-semibold text-foreground">una sola vez</span>.
      </p>
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
          placeholder="tu_nuevo_username"
          aria-invalid={availability === "taken" || availability === "invalid"}
          className="w-full bg-transparent px-1.5 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-muted"
        />
        <span className="shrink-0 pr-3 text-xs">
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
      {sameAsCurrent && (
        <p className="text-xs text-danger">Ese ya es tu nombre de usuario.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-brand-strong disabled:opacity-50"
        >
          {submitting ? "Cambiando…" : "Confirmar cambio"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setUsername("");
            setError(null);
          }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-foreground-muted transition hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
