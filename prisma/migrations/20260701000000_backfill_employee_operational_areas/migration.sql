-- Backfill de áreas operativas de empleados (Operaciones-1F.2).
-- Los empleados HISTÓRICOS que operaban como Mozo por compatibilidad temporal
--   (rol = 'mozo' AND areaOperativa = 'sin_asignar')
-- pasan una sola vez a areaOperativa = 'mozo', para conservar el acceso que tenían
-- antes de cerrar la compatibilidad por rol. Como el área persistida cambia
-- realmente, se incrementa asignacionVersion en 1 (mismo criterio que la edición
-- administrativa de área).
--
-- Solo afecta filas con AMBOS valores exactos. NO modifica token, pushSubscription,
-- activo, eliminado, cuentaOperativaId, negocioId ni rol. No crea/borra tablas,
-- columnas, índices ni datos; no altera el schema; no toca ninguna tabla ajena.
-- Nombres físicos verificados: tabla "empleados"; columnas "areaOperativa", "rol",
-- "asignacionVersion" (PostgreSQL, identificadores case-sensitive entre comillas).

UPDATE "empleados"
SET "areaOperativa" = 'mozo',
    "asignacionVersion" = "asignacionVersion" + 1
WHERE "areaOperativa" = 'sin_asignar'
  AND "rol" = 'mozo';
