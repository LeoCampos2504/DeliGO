-- F10-B2.2-G — owner administrative recovery of an employee's open shift.
-- Additive only. The terminal state stays CERRADO_DECLARADO so D (review),
-- E (custody) and F (carryover) keep working unchanged; WHO closed the shift
-- and WHY is recorded separately, never as the employee's own declaration.
--
--   cierreOrigen     RESPONSABLE                  → the responsible person closed it (all historical closes)
--                    RECUPERACION_ADMINISTRATIVA  → the business owner recovered an employee's shift
--   cierreActorTipo  / cierreActorId → the real closing actor (owner = negocioId)
--   cierreMotivo     → mandatory reason of a recovery, NULL otherwise

ALTER TABLE "turnos_caja"
  ADD COLUMN "cierreOrigen" TEXT,
  ADD COLUMN "cierreActorTipo" TEXT,
  ADD COLUMN "cierreActorId" TEXT,
  ADD COLUMN "cierreMotivo" TEXT;

-- Every close before G was performed by the responsible person (the C service
-- only lets the responsible actor close), so this keeps their exact meaning.
UPDATE "turnos_caja"
SET "cierreOrigen" = 'RESPONSABLE',
    "cierreActorTipo" = "responsableTipo",
    "cierreActorId" = "responsableId"
WHERE "estado" <> 'ABIERTO';

ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_cierre_origen_check" CHECK (
  ("estado" = 'ABIERTO'
    AND "cierreOrigen" IS NULL AND "cierreActorTipo" IS NULL AND "cierreActorId" IS NULL AND "cierreMotivo" IS NULL)
  OR
  ("estado" <> 'ABIERTO' AND "cierreOrigen" = 'RESPONSABLE'
    AND "cierreActorTipo" = "responsableTipo" AND "cierreActorId" = "responsableId" AND "cierreMotivo" IS NULL)
  OR
  ("estado" <> 'ABIERTO' AND "cierreOrigen" = 'RECUPERACION_ADMINISTRATIVA'
    AND "responsableTipo" = 'EMPLEADO'
    AND "cierreActorTipo" = 'NEGOCIO' AND "cierreActorId" = "negocioId"
    AND "cierreMotivo" IS NOT NULL AND length(btrim("cierreMotivo")) BETWEEN 1 AND 500)
);

CREATE INDEX "turnos_caja_negocioId_cierreOrigen_idx" ON "turnos_caja"("negocioId", "cierreOrigen");

CREATE FUNCTION "guard_turno_caja_cierre_origen"() RETURNS trigger AS $$
BEGIN
  -- Rolling-deploy compatibility: a pre-G process closes without these
  -- columns; such a close can only be the responsible person's own close.
  IF NEW."estado" <> 'ABIERTO' AND NEW."cierreOrigen" IS NULL THEN
    NEW."cierreOrigen" := 'RESPONSABLE';
    NEW."cierreActorTipo" := NEW."responsableTipo";
    NEW."cierreActorId" := NEW."responsableId";
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."estado" <> 'ABIERTO' AND (
       NEW."cierreOrigen" IS DISTINCT FROM OLD."cierreOrigen"
    OR NEW."cierreActorTipo" IS DISTINCT FROM OLD."cierreActorTipo"
    OR NEW."cierreActorId" IS DISTINCT FROM OLD."cierreActorId"
    OR NEW."cierreMotivo" IS DISTINCT FROM OLD."cierreMotivo"
  ) THEN
    RAISE EXCEPTION 'closed shift close origin is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "turnos_caja_cierre_origen_trigger"
  BEFORE INSERT OR UPDATE ON "turnos_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_turno_caja_cierre_origen"();
