"use client";

import { useState } from "react";
import { FaUserPlus } from "react-icons/fa6";
import { APP_URL } from "@/lib/appUrl";

/**
 * Panel "Invita y gana" (Bet 1). Comparte el link de perfil del usuario con
 * `?ref=` (atribución de referral); cuando un invitado se registra, el que
 * invita gana la insignia "Embajador". Web Share API en móvil, fallback a copiar.
 */
export function InviteFriendsCard({
  username,
  referralCount,
}: {
  username: string;
  referralCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(username);
  const link = `${APP_URL}/u/${enc}?ref=${enc}`;
  const text =
    "Te reto en Mundialito 2026 ⚽ Pronostica los partidos del Mundial y vemos quién sabe más.";

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mundialito 2026", text, url: link });
        return;
      } catch {
        // Cancelado o no soportado: caemos a copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles: el botón ya cumplió su función visual.
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg text-brand" aria-hidden>
          <FaUserPlus />
        </span>
        <h3 className="text-sm font-bold tracking-tight">Invita y gana</h3>
      </div>
      <p className="text-xs text-foreground-muted">
        Comparte tu link. Cuando un amigo se une, ganas la insignia{" "}
        <span className="font-semibold text-foreground">Embajador</span>.
      </p>
      <button
        type="button"
        onClick={share}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-background transition hover:bg-brand-strong"
      >
        {copied ? "¡Link copiado!" : "Compartir mi link"}
      </button>
      <p className="text-[11px] text-foreground-muted">
        {referralCount > 0
          ? `${referralCount} ${referralCount === 1 ? "amigo se unió" : "amigos se unieron"} con tu link.`
          : "Todavía nadie se unió con tu link. ¡Sé el primero en invitar!"}
      </p>
    </div>
  );
}
