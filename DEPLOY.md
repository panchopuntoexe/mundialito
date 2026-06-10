# Guía de deploy — Prode Mundial

Deploy a producción en **Vercel** + **Supabase** + **Upstash**. Seguir en orden.
Tiempo estimado: ~30–45 min la primera vez.

> Pre-requisito: el código pasa `npm run lint`, `npm run type-check`,
> `npm run test` y `npm run build` en local. (Verificado en la Fase 8.)

---

## 0. Cuentas necesarias


| Servicio      | Para qué                       | Plan mínimo                    |
| ------------- | ------------------------------ | ------------------------------ |
| Supabase      | DB + Auth + Realtime + Storage | Free (Pro recomendado en prod) |
| Upstash Redis | Caché y rate limiting          | Free                           |
| Vercel        | Hosting + Cron Jobs            | Hobby (Pro para más crons)     |
| API-Football  | Live scores                    | Pro (~$19/mes) — ver §6 ARCH   |


---

## 1. Supabase (base de datos)

1. **Crear proyecto** en [https://supabase.com/dashboard](https://supabase.com/dashboard) → anotar la región.
2. **Linkear y aplicar migraciones** desde tu máquina:
  ```bash
   npx supabase login
   npx supabase link --project-ref <TU_PROJECT_REF>
   npx supabase db push        # aplica supabase/migrations/0001..0009
  ```
   Esto crea las 9 tablas (incluida `push_subscriptions`), RLS, funciones
   (`apply_match_results`, `is_league_member`) y agrega `users` a la publicación
   Realtime.
3. **Auth** → Authentication → Providers:
  - Habilitar **Email**.
  - Habilitar **Google**: pegar Client ID/Secret de Google Cloud Console.
4. **Auth → URL Configuration** (se completa al final, §5, con el dominio de Vercel):
  - Site URL: `https://<tu-dominio>`
  - Redirect URLs: `https://<tu-dominio>/callback`
5. **Storage**: el bucket público `wrapped` se **crea solo** en la primera corrida
  del cron de Wrapped (`ensureBucket`). No hace falta crearlo a mano.
6. Copiar de **Settings → API**:
  - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public)
  - `SUPABASE_SERVICE_ROLE_KEY` (service_role — **secreto**)

---

## 2. Upstash Redis

1. Crear una base **Redis** en [https://console.upstash.com](https://console.upstash.com) (región cercana a la
  de Vercel/Supabase).
2. Copiar de la pestaña REST:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

---

## 3. API-Football

1. Suscribirse en [https://www.api-football.com](https://www.api-football.com) (plan Pro — ver carga en
  `ARCHITECTURE.md §6`).
2. Copiar `API_FOOTBALL_KEY`.

---

## 4. Secretos generados

```bash
# CRON_SECRET — cualquier string aleatorio largo:
openssl rand -hex 32          # o en PowerShell: [guid]::NewGuid().ToString("N")

# Claves VAPID para push (OPCIONAL — si querés notificaciones):
npm run gen:vapid             # imprime las 3 vars VAPID
```

---

## 5. Vercel (deploy)

1. **Importar el repo** en [https://vercel.com/new](https://vercel.com/new) (framework Next.js, autodetectado).
2. **Environment Variables** (Project → Settings → Environment Variables) — todas
  en *Production* (y *Preview* si querés previews funcionales):
3. **Deploy.** Los Cron Jobs (`vercel.json`) se registran automáticamente:
  - `match-sync` cada minuto, `process-results` cada 5 min, `generate-wrapped`
   diario 04:00 UTC. Vercel inyecta `Authorization: Bearer ${CRON_SECRET}`.
  - Nota: el plan **Hobby** de Vercel limita crons a 1/día. Para `match-sync`
  por minuto necesitás plan **Pro**.
4. **Volver a Supabase** (§1.4) y poner el dominio real de Vercel en Site URL y
  Redirect URLs. En Google Cloud Console agregar el mismo `/callback` a los
   "Authorized redirect URIs".

---

## 6. Seed del fixture (una vez)

Cargar los 104 partidos del Mundial en la DB de producción. Desde tu máquina,
apuntando a las credenciales de prod (`.env.local` con la URL/keys de prod, o
exportando las vars):

```bash
npm run db:seed
```

Re-correrlo no duplica (upsert por `external_ref`).

---

## 7. Verificación post-deploy

- [x] Abrir el dominio → login con Google/email funciona → onboarding pide username.
- [x] La home muestra los partidos del día (tras el seed).
- [ ] **PWA**: en Chrome/Android aparece "Instalar app"; en iOS, "Agregar a inicio".
  ```
  Correr Lighthouse → categoría PWA / "Installable".
  ```
- [ ] **Offline**: instalar, navegar, activar modo avión → el historial visitado
  ```
  carga y aparece la pantalla offline en rutas nuevas.
  ```
- [ ] **Cron**: en Vercel → Deployments → Cron Jobs, ver ejecuciones 200 (no 401).
- [ ] **Rate limit**: hacer >20 POST de pronóstico en 1 min → 429.
- [ ] **Push** (si configuraste VAPID): en la home, "Activar" notificaciones →
  ```
  "Enviar notificación de prueba" → llega al dispositivo.
  ```
- [ ] **Seguridad**: en Supabase SQL Editor, la query de `docs/security-audit.md`
  ```
  §1 no devuelve filas.
  ```

---

## 8. Notas

- **Sin VAPID**: el push queda deshabilitado y la tarjeta de notificaciones se
autooculta. Todo lo demás funciona igual.
- **Service Worker**: solo se registra en `NODE_ENV=production` (no en `npm run dev`), así que para probarlo en local usá `npm run build && npm start`.
- **Rotación de secretos**: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` y
`VAPID_PRIVATE_KEY` viven solo en las env vars de Vercel. Rotar las VAPID
invalida todas las suscripciones push existentes.

