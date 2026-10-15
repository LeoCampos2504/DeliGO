-- F10-B2.2-F corrective (additive) migration.
--
-- TESTING applied 20261015120000_f10_b2_2_f_cash_fund_carryover from commit
-- 35395f3, whose "is the source still the latest shift?" check did not exclude
-- the receiving shift itself. The receiving shift is inserted before its
-- transfer row, so every legitimate carryover was rejected with
-- 'fund transfer source is no longer the latest shift' (HTTP 500 on opening).
-- The fix was later written into the already-applied migration file, which
-- Prisma never re-runs. This migration installs the corrected function on
-- every database; on a fresh database it is a no-op replacement with the same
-- body. Trigger bindings, tables and indexes are unchanged.

CREATE OR REPLACE FUNCTION "validate_fondo_transfer_turno_caja"() RETURNS trigger AS $$
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
     OR destino."abiertoEn" < origen."abiertoEn"
     OR (destino."abiertoEn" = origen."abiertoEn" AND destino."id" <= origen."id")
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
      AND newer."id" <> NEW."turnoDestinoId"
      AND (newer."abiertoEn" > origen."abiertoEn"
        OR (newer."abiertoEn" = origen."abiertoEn" AND newer."id" > origen."id"))
  ) THEN
    RAISE EXCEPTION 'fund transfer source is no longer the latest shift';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
