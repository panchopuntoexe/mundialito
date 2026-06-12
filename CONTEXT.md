# Mundialito

Lenguaje de dominio de la PWA de pronósticos del Mundial 2026. Esta es la fuente de verdad de los términos; si el código o los docs usan otra palabra para el mismo concepto, está mal — resolver aquí primero.

## Language

**Partido del día**:
El conjunto de _todos_ los partidos cuyo kickoff cae en el día actual. Los partidos de días futuros no están disponibles para pronosticar hasta que llega su día.
_Avoid_: "el partido del día" en singular (el producto no curaba un único partido — se predicen todos los del día).

**Pronóstico** (Prediction):
La apuesta de un usuario sobre un partido: un `result_pred` (local/empate/visitante) y un `goals_range_pred` (rango de goles totales). Uno solo por usuario por partido, inmutable tras el kickoff.
_Avoid_: apuesta (no hay dinero), bet.

**Racha** (Streak):
Cadena de **participación** consecutiva. Un día cuenta como participado solo si el usuario pronosticó **todos los partidos del día que aún estaban abiertos** (kickoff en el futuro) al momento de su primer pronóstico de ese día — así la racha siempre es alcanzable para quien se presenta, sin caer en la trampa de partidos ya cerrados antes de abrir la app. NO mide aciertos: no se rompe por fallar, solo por dejar abierto un partido sin pronosticar. El límite de "día" usa una **zona horaria fija del torneo** (no la local del usuario). Se actualiza al **enviar el pronóstico** (no en el cron de resultados). Es una métrica **puramente de engagement** (badge 🔥, freeze, Wrapped, achievements) y **NO** afecta los puntos.
_Avoid_: "racha de aciertos" (term obsoleto de ARCHITECTURE.md §3 — la racha es de participación, no de precisión).

**Puntos** (Points):
Recompensa por **precisión** únicamente: 10 por acertar el `result_pred`, +15 de bonus si además se acierta el `goals_range_pred` (el bonus exige resultado correcto). NO hay multiplicador por racha. El leaderboard es un ranking de habilidad pura.
_Avoid_: multiplicador de racha (la tabla ×1.2/×1.5/×2.0 de ARCHITECTURE.md §3 queda ELIMINADA).

**Nivel** (Level):
Capa de status **derivada** de `users.total_points` — no se persiste ni afecta el ranking. Cuatro tramos tipo "rol de jugador": **Suplente (0) → Titular (100) → Crack (300) → Leyenda (700+)**. Se calcula al vuelo donde se muestra: el header (junto al `@username`), las filas de leaderboard y la tarjeta Wrapped (snapshot `levelKey`). Umbrales y nombres centralizados en `lib/scoring/levels.ts`.
_Avoid_: guardar el nivel en DB, o calcularlo desde los puntos de una fase (mira el **total acumulado** del torneo, no `stats.totalPoints` de la tarjeta).

**Goles totales** (Total goals):
Base del `goals_range`. Cuenta **todos los goles del partido en sí — tiempo reglamentario + alargue — excluyendo la tanda de penales** (la tanda es un desempate, no goles del partido). Buckets: 0-1 / 2-3 / 4-5 / 6+. En grupos nunca hay alargue, así que colapsa al marcador de 90'. `score_home`/`score_away` guardan el marcador **post-alargue, pre-tanda** (puede quedar empatado aunque haya un equipo que avanza).
_Avoid_: contar goles de la tanda de penales en `total_goals`.

**Equipo que avanza** (`winner_team` / `advances`):
Campo explícito en `matches` (`'home' | 'away' | null`) que registra quién avanza en knockout. Necesario porque `score_home`/`score_away` pueden estar empatados. En grupos es null y el resultado se deriva del marcador.

**Resultado** (Match result):
Lo que se acierta con `result_pred`. Depende de la fase:

- **Fase de grupos**: resultado a los 90' (local / empate / visitante). El empate es válido.
- **Knockout**: el equipo que **avanza** (decidido por 90', alargue o penales). NO existe empate — el `draw` se deshabilita en UI y se rechaza server-side para partidos de knockout. Como un partido de knockout puede quedar empatado en el marcador (p. ej. 1-1 que se define por penales), el resultado **no se puede derivar de `score_home`/`score_away`** — la fila `matches` debe registrar el equipo que avanza explícitamente.
  _Avoid_: asumir que `deriveResult(score_home, score_away)` basta (falla en knockouts empatados).

**Identidad del partido** (Match identity):
La fila `matches` tiene **PK sintética propia** (no la de ningún proveedor). Los IDs externos son columnas de lookup re-apuntables: `api_football_id` (unique, para el sync de scores en vivo) y `external_ref` (worldcup26.ir, para el seed del fixture estático). `predictions.match_id` referencia la PK interna. Cambiar de proveedor de scores = un `UPDATE` de columna, no una migración de PK.
_Avoid_: usar el ID de API-Football como PK (lock-in de proveedor sobre la PK que referencian todas las predictions).

**Liga** (League):
Grupo privado de competencia. Una liga es un **filtro sobre el puntaje global** (qué usuarios), NO un ledger de puntos aparte. El ranking de una liga ordena a sus miembros por su **total de puntos del torneo completo**, sin importar cuándo se unieron. Un usuario que entra tarde trae todo su historial.
_Avoid_: `league_members.total_points` como contador desde la fecha de ingreso (queda eliminado; se rankea por el total de torneo del usuario — `users.total_points` o suma de `predictions.points_earned`).

**Freeze** (Congelar racha):
Salvavidas de la **Racha**. Si el usuario no completa la participación de un día y tiene un freeze disponible, se consume **automáticamente** (sin UI ni acción del usuario) y la racha sobrevive. Se recarga **una vez por macro-ronda**.
_Avoid_: freeze de activación manual (genera "perdí la racha aunque tenía freeze").

**Macro-ronda** (Macro-round):
Agrupación de fases para límites de torneo (recarga de freeze, generación de Wrapped): **Fase de grupos → Octavos (Round of 32) → 16avos (Round of 16) → Cuartos → Semifinales → Final**. Distinto de `matches.phase`, que es granular (`group_a`…`group_l`, `round_32`, …). "Una vez por fase" significa una vez por macro-ronda, NO una por cada uno de los 12 grupos.
_Avoid_: interpretar "fase" como grupo individual para recargas/Wrapped.

**Fallo épico** (Epic miss):
Para la tarjeta Wrapped: entre los pronósticos **incorrectos** del usuario en la fase, aquel que maximiza el **% de usuarios que SÍ acertaron** ese partido — el "todos lo vieron venir menos yo". Se calcula con la distribución de consenso que ya produce el endpoint `/consensus` (task 4.6).
_Avoid_: "la predicción incorrecta que menos usuarios acertaron" (texto original de ARCHITECTURE.md §4.4 — está al revés: ese sería el fallo más excusable, no el más épico).

**Logro / Insignia** (Achievement / Badge):
Reconocimiento puntual que un usuario gana al cumplir un criterio. Vive en la tabla `achievements` (único por `(user_id, type)`), lo **otorga idempotente** el cron de resultados, y cada tipo lleva metadatos de presentación (`label`/`icon`/`description`) en `lib/scoring/achievements.ts`. Ejemplos: **Telonero** (pronosticó el primer partido del torneo, por orden de kickoff) y **En racha** (más de 3 aciertos de **resultado consecutivos**, ordenados por kickoff).
_Avoid_: confundir **En racha** (aciertos consecutivos) con la **Racha** (participación) — son métricas distintas pese al nombre parecido.

**Invitado** (Guest):
Usuario que entró con **"Jugar sin cuenta"**: un usuario anónimo de Supabase (usuario `authenticated` real, `is_anonymous: true`) con username auto-generado `invitado_xxxxxx`. Juega exactamente igual que un usuario registrado (pronostica, suma puntos, rachas, logros, ligas); su única diferencia es que la sesión vive solo en ese dispositivo hasta que **guarda su cuenta** vinculando Google (`linkIdentity`, mismo `user.id`, progreso intacto). Si cierra sesión sin guardar, el progreso se pierde. Tras guardar, puede **cambiar su username una sola vez** (`PATCH /api/users`, trigger en `users.username_changed_at`); el prefijo `invitado_` está reservado para los auto-generados.
_Avoid_: "modo lectura" o usuario sin fila en `users` (el invitado tiene perfil completo); políticas RLS especiales para invitados (no existen — es un usuario authenticated normal).

**Ranking** (sección pública):
Pantalla de clasificación con **filtros orientados a datos**, separada del ranking de **Liga** (que es un filtro privado por miembros). Tres vistas: **Puntos** (total de torneo), **Precisión** (% de aciertos sobre la vista SQL `user_accuracy`, con mínimo de pronósticos para entrar) y **Racha** (racha máxima de participación). Cada métrica se cachea por separado en Redis.
_Avoid_: mezclar la sección Ranking (global, pública) con el ranking de una Liga (subconjunto de miembros).

## Relationships

- Un **Pronóstico** pertenece a exactamente un usuario y un **Partido del día**.
- Una **Racha** mide días/participación consecutiva de un usuario, independientemente de si sus **Pronósticos** fueron correctos.
- Una **Liga** rankea a sus miembros por el total de **Puntos** de torneo de cada uno (filtro, no ledger separado).
- Un **Nivel** se deriva del total de **Puntos** de un usuario (no se persiste ni rankea).
- Un **Logro** pertenece a un usuario; **En racha** cuenta **aciertos** consecutivos, no participación (≠ **Racha**).
- El **Ranking** público ordena por una métrica de datos (Puntos / Precisión / Racha); la **Liga** es el mismo concepto acotado a sus miembros.

## Flagged ambiguities

- **"Racha"** (RESUELTO): la racha es de **participación** y está **desacoplada** de los puntos. Los puntos son 100% precisión; la racha es 100% engagement. El multiplicador ×1.2/×1.5/×2.0 de ARCHITECTURE.md §3 queda eliminado. ARCHITECTURE.md §3, §4.3 y §4.5 ya reflejan esto (ver ADR 0001).
- **"Partido del día"**: el endpoint task 3.4 lo nombra "partido(s) del día" en plural, consistente con esta definición; CLAUDE.md lo vendía en singular (Wordle) — resuelto a favor de "todos los del día", con un partido destacado en UI por definir.
