-- P2-T43-R2: employee internal codes are unique only among non-deleted rows.
-- Historical soft-deleted employees retain their original code and row.
DROP INDEX IF EXISTS "empleados_negocioId_codigo_key";

CREATE UNIQUE INDEX "empleados_negocioId_codigo_active_key"
  ON "empleados" ("negocioId", "codigo")
  WHERE "eliminado" = false;
