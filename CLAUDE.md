# CLAUDE.md

> Archivo de contexto que Claude Code lee automáticamente al abrir el proyecto.
> Mantenerlo actualizado. Si una decisión cambia, actualizar aquí primero.

---

## Qué es este proyecto

**Mundialito** — Una PWA de pronósticos del Mundial de fútbol 2026, mobile-first.

El usuario pronostica los partidos del día (todos los del día actual) antes de cada kickoff, acumula puntos por precisión, sostiene una racha de participación diaria, compite con amigos en ligas privadas, y al final de cada macro-ronda obtiene una tarjeta "Wrapped" compartible en redes sociales.

**NO es una app de apuestas.** No hay dinero real. El valor es reputación, gamificación y viralidad social. Esto es una decisión de producto y legal — nunca introducir mecánicas de apuesta con dinero.

### El loop de engagement

1. Usuario ve los partidos del día → pronostica cada uno antes de su kickoff (predecir todos los abiertos del día mantiene su racha).
2. El pronóstico se cierra cuando empieza el partido (no se puede cambiar).
3. Al terminar el partido, se calculan puntos automáticamente.
4. El usuario ve su posición en el ranking global y en sus ligas privadas.
5. Comparte su tarjeta (resultado del día o Wrapped de fase) → atrae nuevos usuarios.

---

## Stack tecnológico

| Capa              | Tecnología                   | Razón                                               |
| ----------------- | ---------------------------- | --------------------------------------------------- |
| Framework         | Next.js 16 (App Router)      | Fullstack en un repo, Server Components, API Routes |
| Lenguaje          | TypeScript (strict)          | Tipado en todo el stack                             |
| Base de datos     | Supabase (PostgreSQL)        | DB + Auth + Realtime + Storage en un solo servicio  |
| Realtime          | Supabase Realtime            | Leaderboards en vivo sin polling                    |
| Caché             | Upstash Redis                | Serverless, evita quemar API-Football               |
| Estado servidor   | TanStack Query (React Query) | Cache y sincronización de datos                     |
| Estado UI         | Zustand                      | Estado ligero del cliente                           |
| Estilos           | Tailwind CSS                 | Mobile-first, rápido                                |
| Deploy            | Vercel                       | Deploy automático, Edge, Cron Jobs nativos          |
| CI/CD             | GitHub Actions               | Lint, type-check, tests en cada PR                  |
| Datos de partidos | API-Football + worldcup26.ir | Live scores + fixture estático                      |

---

## Reglas de arquitectura (NO romper)

1. **NUNCA llamar API-Football desde el frontend.** Todo dato externo pasa por el backend → caché → DB. El frontend solo habla con nuestras API Routes.
2. **Toda lectura de datos de partidos pasa por la capa de caché (Redis).** Nunca golpear la DB ni la API externa directo en cada request del usuario.
3. **La validación de la ventana de pronóstico es server-side.** El cliente puede ocultar el botón, pero el servidor SIEMPRE re-valida que `kickoff_at > now()` antes de aceptar un pronóstico.
4. **El cálculo de puntos es server-side y idempotente.** Un partido procesado dos veces no debe duplicar puntos.
5. **Nada de mecánicas de dinero real.** Ver sección "Qué es este proyecto".

---

## Convenciones de código

- **TypeScript strict mode** activado. Nada de `any` sin justificación en comentario.
- **Componentes**: PascalCase. Hooks: `useCamelCase`. Utils: `camelCase`.
- **Server Components por defecto.** Usar `"use client"` solo cuando se necesite interactividad o hooks de cliente.
- **Validación de inputs con Zod** en todas las API Routes.
- **Errores**: nunca tragar errores en silencio. Loggear y retornar respuesta tipada.
- **Nombres de archivos**: `kebab-case.ts` para utils, `PascalCase.tsx` para componentes.
- **Imports absolutos** con alias `@/` (configurado en `tsconfig.json`).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).

---

## Estructura de carpetas

```
/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Rutas de autenticación
│   ├── (main)/               # App principal (pronóstico, perfil, ligas)
│   ├── api/                  # API Routes (backend)
│   │   ├── auth/
│   │   ├── predictions/
│   │   ├── matches/
│   │   ├── leagues/
│   │   └── wrapped/
│   └── layout.tsx
├── components/               # Componentes React reutilizables
├── lib/                      # Lógica de negocio y clientes
│   ├── supabase/             # Cliente Supabase (server y client)
│   ├── redis/                # Cliente Upstash + helpers de caché
│   ├── scoring/              # Algoritmo de cálculo de puntos
│   ├── external/             # Clientes de API-Football y worldcup26.ir
│   └── validations/          # Schemas de Zod
├── jobs/                     # Lógica de los Cron Jobs
├── types/                    # Tipos TypeScript compartidos
├── supabase/migrations/      # Migraciones SQL
└── public/                   # Assets + manifest PWA
```

---

## Comandos

```bash
npm run dev          # Desarrollo local (puerto 3000)
npm run build        # Build de producción
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Tests (Vitest)
npx supabase db push # Aplicar migraciones a Supabase
```

---

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Solo server-side, NUNCA exponer
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
API_FOOTBALL_KEY=                 # Solo server-side
CRON_SECRET=                      # Protege los endpoints de cron

# Web Push / VAPID — opcionales (habilitan push notifications, tarea 8.3).
# Generar con `npm run gen:vapid`. Si faltan, el push queda deshabilitado.
NEXT_PUBLIC_VAPID_PUBLIC_KEY=     # Pública (va al cliente)
VAPID_PRIVATE_KEY=               # Solo server-side, NUNCA exponer
VAPID_SUBJECT=                   # 'mailto:...' o URL de contacto del emisor
```

---

## Cómo trabajar en este proyecto

- Antes de escribir código, revisar `ARCHITECTURE.md` (flujo técnico) y `CONTEXT.md` (lenguaje de dominio: qué significa cada término). Las decisiones difíciles de revertir están en `docs/adr/`.
- Las tareas están en `TASKS.md`, granulares y en orden. Trabajar una tarea = un commit.
- Cada tarea tiene criterios de aceptación. No marcar como hecha sin cumplirlos.
- Si una tarea revela que la arquitectura necesita cambiar, actualizar `ARCHITECTURE.md` y `CLAUDE.md` antes de continuar.
