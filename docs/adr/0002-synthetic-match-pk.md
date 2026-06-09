# PK sintética para `matches`, IDs de proveedor como columnas

La tabla `matches` usa una **primary key sintética propia**. Los identificadores externos son columnas de lookup únicas y re-apuntables: `api_football_id` (sync de scores en vivo) y `external_ref` (fixture estático de worldcup26.ir). `predictions.match_id` referencia la PK interna.

## Contexto

ARCHITECTURE.md definía `matches.id bigint primary key -- id de API-Football`, pero TASKS.md 3.3 sembraba el fixture desde worldcup26.ir, que no comparte esos IDs — una contradicción directa. Además, usar el ID de un proveedor como PK lo ata todo (predictions, puntos, claves de caché) a ese proveedor.

## Decisión

PK interna propia (alternativas rechazadas: ID de API-Football como PK, ID de worldcup26.ir como PK). En un producto en vivo de 39 días, la PK no puede ser el número de un tercero: un cambio de proveedor de scores, o un fixture renumerado tras una reprogramación, se vuelve una migración de PK referenciada por cada predicción.

## Consecuencias

- El seed (3.3) matchea por `external_ref`; el sync (5.4) matchea por `api_football_id`.
- Cambiar de proveedor de live scores = un `UPDATE` de columna, no una migración de PK.
- Resuelve la contradicción seed-vs-PK entre ARCHITECTURE.md y TASKS.md 3.3.
