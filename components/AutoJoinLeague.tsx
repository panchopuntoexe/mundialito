"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Auto-unión a una liga desde el deep link (/leagues/join?code=…). Con sesión
 * activa, postea al endpoint existente (idempotente: si ya era miembro responde
 * OK igual) y redirige a la página de la liga. El usuario no tipea nada.
 */
export function AutoJoinLeague({
  code,
  leagueName,
}: {
  code: string;
  leagueName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Evita el doble POST de StrictMode/dev; el endpoint igual es idempotente.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const res = await fetch("/api/leagues/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_code: code }),
        });
        const data: { league?: { id: string }; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (res.ok && data.league?.id) {
          router.replace(`/leagues/${data.league.id}`);
          return;
        }
        setError(data.error ?? "No se pudo unir a la liga.");
      } catch {
        setError("Error de red. Probá de nuevo.");
      }
    })();
  }, [code, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
        <Link
          href="/leagues"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-strong"
        >
          Ir a mis ligas
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-6 text-center"
      role="status"
    >
      <span className="text-3xl" aria-hidden>
        🏆
      </span>
      <p className="text-sm text-foreground-muted">
        Uniéndote a <span className="font-semibold text-foreground">{leagueName}</span>…
      </p>
    </div>
  );
}
