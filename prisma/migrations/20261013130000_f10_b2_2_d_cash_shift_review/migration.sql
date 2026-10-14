-- F10-B2.2-D — immutable review events and stable expected-cash snapshots.
-- Backfill snapshots for existing declared closures without changing their
-- original employee count or creating any financial operation.
ALTER TABLE "turnos_caja"
  ADD COLUMN "efectivoEsperadoDecimal" DECIMAL(12,2);

UPDATE "turnos_caja" AS t
SET "efectivoEsperadoDecimal" = t."fondoInicialDecimal" + COALESCE((
  SELECT SUM(COALESCE(m."importeDecimal", ROUND(m."importe"::numeric, 2)))
  FROM "cuentas_financieras" AS c
  JOIN "movimientos_financieros" AS m
    ON m."cuentaId" = c."id"
   AND m."negocioId" = c."negocioId"
  JOIN "operaciones_financieras" AS o
    ON o."id" = m."operacionId"
   AND o."negocioId" = t."negocioId"
  WHERE c."negocioId" = t."negocioId"
    AND c."cajaFisicaId" = t."cajaFisicaId"
    AND c."tipo" = 'EFECTIVO'
    AND o."turnoCajaId" = t."id"
), 0)
WHERE t."estado" = 'CERRADO_DECLARADO'
  AND t."efectivoContadoDecimal" IS NOT NULL;

CREATE FUNCTION "set_turno_efectivo_esperado_snapshot"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."estado" = 'CERRADO_DECLARADO'
     AND (
       NEW."estado" IS DISTINCT FROM OLD."estado"
       OR NEW."cerradoEn" IS DISTINCT FROM OLD."cerradoEn"
       OR NEW."efectivoContadoDecimal" IS DISTINCT FROM OLD."efectivoContadoDecimal"
       OR NEW."efectivoEsperadoDecimal" IS DISTINCT FROM OLD."efectivoEsperadoDecimal"
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
     OR NEW."cajaFisicaId" IS DISTINCT FROM OLD."cajaFisicaId"
     OR NEW."fondoInicialDecimal" IS DISTINCT FROM OLD."fondoInicialDecimal"
     OR NEW."abiertoEn" IS DISTINCT FROM OLD."abiertoEn"
     OR NEW."responsableTipo" IS DISTINCT FROM OLD."responsableTipo"
     OR NEW."responsableId" IS DISTINCT FROM OLD."responsableId"
     OR NEW."empleadoId" IS DISTINCT FROM OLD."empleadoId"
     ) THEN
    RAISE EXCEPTION 'closed shift declaration and expected-cash snapshot are immutable';
  END IF;

  -- Compatibility during rolling deployment: the prior C process does not
  -- write the new column, so the database fixes the same snapshot atomically.
  IF NEW."estado" = 'CERRADO_DECLARADO' AND NEW."efectivoEsperadoDecimal" IS NULL THEN
    NEW."efectivoEsperadoDecimal" := NEW."fondoInicialDecimal" + COALESCE((
      SELECT SUM(COALESCE(m."importeDecimal", ROUND(m."importe"::numeric, 2)))
      FROM "cuentas_financieras" AS c
      JOIN "movimientos_financieros" AS m
        ON m."cuentaId" = c."id"
       AND m."negocioId" = c."negocioId"
      JOIN "operaciones_financieras" AS o
        ON o."id" = m."operacionId"
       AND o."negocioId" = NEW."negocioId"
      WHERE c."negocioId" = NEW."negocioId"
        AND c."cajaFisicaId" = NEW."cajaFisicaId"
        AND c."tipo" = 'EFECTIVO'
        AND o."turnoCajaId" = NEW."id"
    ), 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "turnos_caja_efectivo_esperado_snapshot_trigger"
  BEFORE INSERT OR UPDATE OF "estado", "cerradoEn", "efectivoContadoDecimal", "efectivoEsperadoDecimal",
    "id", "negocioId", "cajaFisicaId", "fondoInicialDecimal", "abiertoEn", "responsableTipo", "responsableId", "empleadoId"
  ON "turnos_caja"
  FOR EACH ROW EXECUTE FUNCTION "set_turno_efectivo_esperado_snapshot"();
ALTER TABLE "turnos_caja"
  ADD CONSTRAINT "turnos_caja_efectivo_esperado_cierre_check"
  CHECK ("estado" <> 'CERRADO_DECLARADO' OR "efectivoEsperadoDecimal" IS NOT NULL);

CREATE UNIQUE INDEX "turnos_caja_id_negocioId_key"
  ON "turnos_caja"("id", "negocioId");

CREATE TABLE "revisiones_turnos_caja" (
  "id" TEXT NOT NULL,
  "negocioId" TEXT NOT NULL,
  "turnoCajaId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "accion" TEXT NOT NULL DEFAULT 'REVISION_ADMINISTRATIVA',
  "observacion" TEXT,
  "efectivoEsperadoDecimal" DECIMAL(12,2) NOT NULL,
  "efectivoContadoDecimal" DECIMAL(12,2) NOT NULL,
  "diferenciaDecimal" DECIMAL(13,2) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "revisiones_turnos_caja_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "revisiones_turnos_caja_action_check"
    CHECK ("accion" = 'REVISION_ADMINISTRATIVA'),
  CONSTRAINT "revisiones_turnos_caja_observacion_check"
    CHECK ("observacion" IS NULL OR length("observacion") <= 1000),
  CONSTRAINT "revisiones_turnos_caja_diferencia_check"
    CHECK ("diferenciaDecimal" = "efectivoContadoDecimal" - "efectivoEsperadoDecimal"),
  CONSTRAINT "revisiones_turnos_caja_observacion_diferencia_check"
    CHECK ("diferenciaDecimal" = 0 OR ("observacion" IS NOT NULL AND length(btrim("observacion")) > 0)),
  CONSTRAINT "revisiones_turnos_caja_turnoCajaId_negocioId_fkey"
    FOREIGN KEY ("turnoCajaId", "negocioId")
    REFERENCES "turnos_caja"("id", "negocioId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE FUNCTION "reject_revision_turno_caja_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'administrative cash-shift reviews are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "revisiones_turnos_caja_immutable_update_trigger"
  BEFORE UPDATE ON "revisiones_turnos_caja"
  FOR EACH ROW EXECUTE FUNCTION "reject_revision_turno_caja_update"();
CREATE UNIQUE INDEX "revisiones_turnos_caja_negocioId_idempotencyKey_key"
  ON "revisiones_turnos_caja"("negocioId", "idempotencyKey");
CREATE INDEX "revisiones_turnos_caja_negocioId_turnoCajaId_createdAt_idx"
  ON "revisiones_turnos_caja"("negocioId", "turnoCajaId", "createdAt");
