-- Forward-only additive migration: agrega el área operativa administrativa a empleados.
-- Las columnas NOT NULL llevan DEFAULT, por lo que TODOS los empleados existentes quedan
-- inicialmente en 'sin_asignar' / asignacionVersion 1 sin necesidad de backfill.
-- No actualiza filas existentes, no renombra tablas/columnas/índices/constraints y no
-- toca `rol` ni `permisos`.

ALTER TABLE "empleados"
  ADD COLUMN "areaOperativa" TEXT NOT NULL DEFAULT 'sin_asignar',
  ADD COLUMN "asignacionVersion" INTEGER NOT NULL DEFAULT 1;
