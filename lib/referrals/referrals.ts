import { createAdminClient } from "@/lib/supabase/server";

/**
 * Referrals (Bet 1) — server-only (cliente admin).
 *
 * Atribución "quién trajo a quién" + recompensa de status (insignia "Embajador").
 * NO suma puntos: el ranking refleja solo habilidad de pronóstico. Todo es
 * best-effort: cualquier fallo se loguea y se traga para no romper el registro
 * ni la pantalla de stats (incluso si la migración 0018 aún no se aplicó).
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Atribuye el referral de un usuario recién registrado y le otorga al que lo
 * invitó la insignia "Embajador" (idempotente). `refUsername` sale de la cookie
 * `mundialito_ref` (la setea el proxy desde `?ref=<username>`).
 */
export async function attachReferral(params: {
  admin: Admin;
  newUserId: string;
  newUsername: string;
  refUsername: string | null;
}): Promise<void> {
  const { admin, newUserId, newUsername, refUsername } = params;
  if (!refUsername) return;
  // No te puedes referir a vos mismo.
  if (refUsername.toLowerCase() === newUsername.toLowerCase()) return;

  try {
    const { data: referrer } = await admin
      .from("users")
      .select("id")
      .eq("username", refUsername.toLowerCase())
      .maybeSingle();
    if (!referrer || referrer.id === newUserId) return;

    const { error: updErr } = await admin
      .from("users")
      .update({ referred_by: referrer.id })
      .eq("id", newUserId);
    if (updErr) {
      // p.ej. columna inexistente (migración 0018 pendiente): no romper el alta.
      console.error("[referrals] no se pudo setear referred_by:", updErr.message);
      return;
    }

    const { error: achErr } = await admin
      .from("achievements")
      .upsert(
        { user_id: referrer.id, type: "ambassador" },
        { onConflict: "user_id,type", ignoreDuplicates: true },
      );
    if (achErr) {
      console.error("[referrals] no se pudo otorgar Embajador:", achErr.message);
    }
  } catch (err) {
    console.error("[referrals] attachReferral falló:", err);
  }
}

/**
 * Cuántos usuarios se registraron con el link de `userId`. 0 si la columna aún
 * no existe o hay error (no rompe la pantalla de stats).
 */
export async function loadReferralCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  try {
    const { count, error } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
