import { z } from "zod";

/**
 * Validación de la suscripción Web Push (tarea 8.3).
 *
 * Refleja el shape de `PushSubscription.toJSON()` del navegador. Solo guardamos
 * lo que el envío necesita: endpoint + claves de cifrado (p256dh, auth).
 * `expirationTime` se ignora (no lo usamos).
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Body del unsubscribe: basta el endpoint para identificar la suscripción. */
export const pushUnsubscribeSchema = z.object({
  endpoint: z.url(),
});
