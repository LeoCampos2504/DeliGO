-- F10-B2.2-E: append-only physical custody of declared close cash. No financial operations are created.
CREATE TABLE "entregas_custodia_turnos_caja" (
  "id" TEXT NOT NULL,
  "negocioId" TEXT NOT NULL,
  "cajaFisicaId" TEXT NOT NULL,
  "turnoCajaId" TEXT NOT NULL,
  "responsableTipo" TEXT NOT NULL,
  "responsableId" TEXT NOT NULL,
  "empleadoId" TEXT,
  "efectivoContadoDecimal" DECIMAL(12,2) NOT NULL,
  "efectivoEsperadoDecimal" DECIMAL(12,2) NOT NULL,
  "diferenciaDecimal" DECIMAL(13,2) NOT NULL,
  "efectivoEntregadoDecimal" DECIMAL(12,2) NOT NULL,
  "fondoRemanenteDecimal" DECIMAL(12,2) NOT NULL,
  "destinoTipo" TEXT NOT NULL,
  "destinoNombre" TEXT,
  "actorId" TEXT NOT NULL,
  "confirmadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observacion" TEXT,
  "tipo" TEXT NOT NULL,
  "secuencia" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entregas_custodia_turnos_caja_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "entregas_custodia_turnos_caja_turnoCajaId_negocioId_fkey" FOREIGN KEY ("turnoCajaId", "negocioId") REFERENCES "turnos_caja"("id", "negocioId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "entregas_custodia_turnos_caja_cajaFisicaId_negocioId_fkey" FOREIGN KEY ("cajaFisicaId", "negocioId") REFERENCES "cajas_fisicas"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "entregas_custodia_turnos_caja_amounts_check" CHECK ("efectivoContadoDecimal" >= 0 AND "efectivoEntregadoDecimal" >= 0 AND "fondoRemanenteDecimal" >= 0 AND "efectivoContadoDecimal" = "efectivoEntregadoDecimal" + "fondoRemanenteDecimal"),
  CONSTRAINT "entregas_custodia_turnos_caja_difference_check" CHECK ("diferenciaDecimal" = "efectivoContadoDecimal" - "efectivoEsperadoDecimal"),
  CONSTRAINT "entregas_custodia_turnos_caja_destination_check" CHECK (("destinoTipo" = 'DUENO' AND "destinoNombre" IS NULL) OR ("destinoTipo" = 'RESGUARDO' AND "destinoNombre" IS NOT NULL AND length(btrim("destinoNombre")) BETWEEN 1 AND 120)),
  CONSTRAINT "entregas_custodia_turnos_caja_event_check" CHECK ("tipo" IN ('ENTREGA_CONFIRMADA', 'RECTIFICACION') AND "estado" = 'CONFIRMADA' AND "secuencia" > 0),
  CONSTRAINT "entregas_custodia_turnos_caja_observacion_check" CHECK ("observacion" IS NULL OR length("observacion") <= 1000),
  CONSTRAINT "entregas_custodia_turnos_caja_rectification_note_check" CHECK ("tipo" <> 'RECTIFICACION' OR ("observacion" IS NOT NULL AND length(btrim("observacion")) > 0))
);
CREATE UNIQUE INDEX "entregas_custodia_turnos_caja_negocioId_idempotencyKey_key" ON "entregas_custodia_turnos_caja"("negocioId", "idempotencyKey");
CREATE UNIQUE INDEX "entregas_custodia_turnos_caja_one_initial_delivery_key" ON "entregas_custodia_turnos_caja"("negocioId", "turnoCajaId") WHERE "tipo" = 'ENTREGA_CONFIRMADA';
CREATE UNIQUE INDEX "entregas_custodia_turnos_caja_negocioId_turnoCajaId_secuencia_key" ON "entregas_custodia_turnos_caja"("negocioId", "turnoCajaId", "secuencia");
CREATE INDEX "entregas_custodia_turnos_caja_negocioId_turnoCajaId_secuencia_idx" ON "entregas_custodia_turnos_caja"("negocioId", "turnoCajaId", "secuencia");
CREATE FUNCTION "validate_custody_turno_caja_event"() RETURNS trigger AS $$
DECLARE turno "turnos_caja"%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN RAISE EXCEPTION 'cash custody events are immutable'; END IF;
  SELECT * INTO turno FROM "turnos_caja" WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" FOR KEY SHARE;
  IF NOT FOUND OR turno."estado" <> 'CERRADO_DECLARADO' OR turno."cerradoEn" IS NULL OR turno."efectivoContadoDecimal" IS NULL OR turno."efectivoEsperadoDecimal" IS NULL THEN RAISE EXCEPTION 'custody requires a declared closed shift'; END IF;
  IF NEW."cajaFisicaId" <> turno."cajaFisicaId" OR NEW."responsableTipo" <> turno."responsableTipo" OR NEW."responsableId" <> turno."responsableId" OR NEW."empleadoId" IS DISTINCT FROM turno."empleadoId" OR NEW."efectivoContadoDecimal" <> turno."efectivoContadoDecimal" OR NEW."efectivoEsperadoDecimal" <> turno."efectivoEsperadoDecimal" OR NEW."diferenciaDecimal" <> turno."efectivoContadoDecimal" - turno."efectivoEsperadoDecimal" OR NEW."actorId" <> NEW."negocioId" OR NEW."estado" <> 'CONFIRMADA' THEN RAISE EXCEPTION 'custody event does not match its authoritative shift snapshot'; END IF;
  IF NEW."tipo" = 'ENTREGA_CONFIRMADA' AND NEW."secuencia" <> 1 THEN RAISE EXCEPTION 'initial delivery must be sequence one'; END IF;
  IF NEW."tipo" = 'RECTIFICACION' AND NEW."secuencia" <> COALESCE((SELECT MAX(e."secuencia") + 1 FROM "entregas_custodia_turnos_caja" e WHERE e."negocioId" = NEW."negocioId" AND e."turnoCajaId" = NEW."turnoCajaId"), 1) THEN RAISE EXCEPTION 'custody event sequence is not contiguous'; END IF;
  IF NEW."tipo" = 'RECTIFICACION' AND NOT EXISTS (SELECT 1 FROM "entregas_custodia_turnos_caja" e WHERE e."negocioId" = NEW."negocioId" AND e."turnoCajaId" = NEW."turnoCajaId" AND e."tipo" = 'ENTREGA_CONFIRMADA') THEN RAISE EXCEPTION 'rectification requires an initial confirmed delivery'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "entregas_custodia_turnos_caja_validate_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "entregas_custodia_turnos_caja" FOR EACH ROW EXECUTE FUNCTION "validate_custody_turno_caja_event"();


