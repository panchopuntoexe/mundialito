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

/**
 * Body del broadcast de anuncios (tarea 8.7). Todos los campos son opcionales:
 * sin body se envía el anuncio por defecto (novedades de la app). `url` es un
 * path interno de la app, nunca una URL externa.
 */
export const pushBroadcastSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(240).optional(),
  url: z
    .string()
    .regex(/^\/[^\s]*$/, "Debe ser un path interno (empieza con /).")
    .optional(),
  tag: z.string().min(1).max(40).optional(),
});

export type PushBroadcastInput = z.infer<typeof pushBroadcastSchema>;
