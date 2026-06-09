# Racha desacoplada de los puntos

La "racha" mide **participación** (días consecutivos en que el usuario pronostica todos los partidos abiertos del día), no aciertos, y **no afecta los puntos**. Los puntos son 100% precisión (10 por resultado + 15 de bonus por rango de goles); la racha es 100% engagement (badge 🔥, freeze, Wrapped, achievements).

## Contexto

ARCHITECTURE.md §3 originalmente definía la racha como racha de _aciertos_ y la usaba como multiplicador de puntos (×1.2 / ×1.5 / ×2.0). Al precisar el dominio, la racha se redefinió como participación. Mantener el multiplicador habría hecho que la simple asistencia multiplicara los puntos de precisión, contaminando el leaderboard: un usuario que se presenta a diario y acierta por suerte superaría a uno que predice poco pero con precisión.

## Decisión

Se eligió **desacoplar** (sobre las alternativas "acoplar asistencia×puntos" y "dos rachas separadas: participación + precisión"). El leaderboard es un ranking de habilidad pura; la racha vive aparte como métrica de hábito y viralidad. La tabla de multiplicadores ×1.2/×1.5/×2.0 de ARCHITECTURE.md §3 queda **eliminada**.

## Consecuencias

- El cálculo de puntos no lee `current_streak`.
- La racha se actualiza al **enviar el pronóstico** (no en el cron de resultados, donde §4.3 la ponía — esa ubicación solo tenía sentido para una racha de aciertos).
