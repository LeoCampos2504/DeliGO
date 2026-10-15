-- F10-B2.2-F: preserve and trace the exact physical cash remainder carried
-- from one closed shift into the next shift of the same physical register.
-- This is custody only: it creates no sale or financial-ledger movement.

CREATE UNIQUE INDEX "turnos_caja_id_negocioId_cajaFisicaId_key"
  ON "turnos_caja"("id", "negocioId", "cajaFisicaId");

CREATE UNIQUE INDEX "entregas_custodia_turnos_caja_id_negocioId_cajaFisicaId_turnoCajaId_key"
  ON "entregas_custodia_turnos_caja"("id", "negocioId", "cajaFisicaId", "turnoCajaId");

CREATE TABLE "traspasos_fondo_turnos_caja" (
  "id" TEXT NOT NULL,
  "negocioId" TEXT NOT NULL,
  "cajaFisicaId" TEXT NOT NULL,
  "turnoOrigenId" TEXT NOT NULL,
  "entregaOrigenId" TEXT NOT NULL,
  "turnoDestinoId" TEXT NOT NULL,
  "montoDecimal" DECIMAL(12,2) NOT NULL,
  "recibidoPorTipo" TEXT NOT NULL,
  "recibidoPorId" TEXT NOT NULL,
  "confirmadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estado" TEXT NOT NULL DEFAULT 'CONFIRMADO',
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "traspasos_fondo_turnos_caja_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "traspasos_fondo_turnos_caja_negocioId_fkey"
    FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "traspasos_fondo_turnos_caja_cajaFisicaId_negocioId_fkey"
    FOREIGN KEY ("cajaFisicaId", "negocioId") REFERENCES "cajas_fisicas"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "traspasos_fondo_turnos_caja_turnoOrigenId_negocioId_cajaFisicaId_fkey"
    FOREIGN KEY ("turnoOrigenId", "negocioId", "cajaFisicaId") REFERENCES "turnos_caja"("id", "negocioId", "cajaFisicaId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "traspasos_fondo_turnos_caja_turnoDestinoId_negocioId_cajaFisicaId_fkey"
    FOREIGN KEY ("turnoDestinoId", "negocioId", "cajaFisicaId") REFERENCES "turnos_caja"("id", "negocioId", "cajaFisicaId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "traspasos_fondo_turnos_caja_entregaOrigenId_negocioId_cajaFisicaId_turnoOrigenId_fkey"
    FOREIGN KEY ("entregaOrigenId", "negocioId", "cajaFisicaId", "turnoOrigenId") REFERENCES "entregas_custodia_turnos_caja"("id", "negocioId", "cajaFisicaId", "turnoCajaId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "traspasos_fondo_turnos_caja_amount_check" CHECK ("montoDecimal" > 0),
  CONSTRAINT "traspasos_fondo_turnos_caja_receiver_check" CHECK ("recibidoPorTipo" IN ('NEGOCIO', 'EMPLEADO')),
  CONSTRAINT "traspasos_fondo_turnos_caja_state_check" CHECK ("estado" = 'CONFIRMADO')
);

CREATE UNIQUE INDEX "traspasos_fondo_turnos_caja_turnoOrigenId_key"
  ON "traspasos_fondo_turnos_caja"("turnoOrigenId");
CREATE UNIQUE INDEX "traspasos_fondo_turnos_caja_entregaOrigenId_key"
  ON "traspasos_fondo_turnos_caja"("entregaOrigenId");
CREATE UNIQUE INDEX "traspasos_fondo_turnos_caja_turnoDestinoId_key"
  ON "traspasos_fondo_turnos_caja"("turnoDestinoId");
CREATE UNIQUE INDEX "traspasos_fondo_turnos_caja_negocioId_idempotencyKey_key"
  ON "traspasos_fondo_turnos_caja"("negocioId", "idempotencyKey");
CREATE INDEX "traspasos_fondo_turnos_caja_negocioId_cajaFisicaId_confirmadoEn_idx"
  ON "traspasos_fondo_turnos_caja"("negocioId", "cajaFisicaId", "confirmadoEn");

CREATE FUNCTION "validate_fondo_transfer_turno_caja"() RETURNS trigger AS $$
DECLARE
  origen "turnos_caja"%ROWTYPE;
  destino "turnos_caja"%ROWTYPE;
  entrega "entregas_custodia_turnos_caja"%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'cash fund transfers are immutable';
  END IF;
  SELECT * INTO origen FROM "turnos_caja"
    WHERE "id" = NEW."turnoOrigenId" AND "negocioId" = NEW."negocioId"
    FOR UPDATE;
  IF NOT FOUND OR origen."cajaFisicaId" <> NEW."cajaFisicaId"
     OR origen."estado" <> 'CERRADO_DECLARADO' OR origen."cerradoEn" IS NULL THEN
    RAISE EXCEPTION 'fund transfer source must be a closed shift of the same register';
  END IF;
  SELECT * INTO destino FROM "turnos_caja"
    WHERE "id" = NEW."turnoDestinoId" AND "negocioId" = NEW."negocioId"
    FOR KEY SHARE;
  IF NOT FOUND OR destino."cajaFisicaId" <> NEW."cajaFisicaId"
     OR destino."estado" <> 'ABIERTO'
     OR destino."fondoInicialDecimal" <> NEW."montoDecimal"
     OR destino."responsableTipo" <> NEW."recibidoPorTipo"
     OR destino."responsableId" <> NEW."recibidoPorId"
     OR destino."idempotencyKey" <> NEW."idempotencyKey"
     OR destino."idempotencyFingerprint" <> NEW."idempotencyFingerprint" THEN
    RAISE EXCEPTION 'fund transfer does not match its receiving shift';
  END IF;
  SELECT * INTO entrega FROM "entregas_custodia_turnos_caja"
    WHERE "id" = NEW."entregaOrigenId"
      AND "negocioId" = NEW."negocioId"
      AND "cajaFisicaId" = NEW."cajaFisicaId"
      AND "turnoCajaId" = NEW."turnoOrigenId";
  IF NOT FOUND OR entrega."estado" <> 'CONFIRMADA'
     OR entrega."fondoRemanenteDecimal" <= 0
     OR entrega."fondoRemanenteDecimal" <> NEW."montoDecimal"
     OR entrega."id" <> (
       SELECT e."id" FROM "entregas_custodia_turnos_caja" e
       WHERE e."negocioId" = NEW."negocioId" AND e."turnoCajaId" = NEW."turnoOrigenId"
       ORDER BY e."secuencia" DESC LIMIT 1
     ) THEN
    RAISE EXCEPTION 'fund transfer must use the exact latest positive confirmed remainder';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "turnos_caja" newer
    WHERE newer."negocioId" = origen."negocioId"
      AND newer."cajaFisicaId" = origen."cajaFisicaId"
      AND (newer."abiertoEn" > origen."abiertoEn"
        OR (newer."abiertoEn" = origen."abiertoEn" AND newer."id" > origen."id"))
  ) THEN
    RAISE EXCEPTION 'fund transfer source is no longer the latest shift';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "traspasos_fondo_turnos_caja_immutable_validate_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "traspasos_fondo_turnos_caja"
  FOR EACH ROW EXECUTE FUNCTION "validate_fondo_transfer_turno_caja"();

CREATE FUNCTION "prevent_rectification_after_fondo_transfer"() RETURNS trigger AS $$
BEGIN
  IF NEW."tipo" = 'RECTIFICACION' THEN
    PERFORM 1 FROM "turnos_caja"
      WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId"
      FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM "traspasos_fondo_turnos_caja"
      WHERE "negocioId" = NEW."negocioId" AND "turnoOrigenId" = NEW."turnoCajaId"
    ) THEN
      RAISE EXCEPTION 'a transferred cash remainder cannot be rectified';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Runs before E's existing validate trigger (same-timing triggers are ordered
-- by name), serializing a rectification against a fund transfer.
CREATE TRIGGER "entregas_custodia_turnos_caja_transfer_guard_trigger"
  BEFORE INSERT ON "entregas_custodia_turnos_caja"
  FOR EACH ROW WHEN (NEW."tipo" = 'RECTIFICACION')
  EXECUTE FUNCTION "prevent_rectification_after_fondo_transfer"();

