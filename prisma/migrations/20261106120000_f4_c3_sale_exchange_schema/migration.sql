-- F4-C3 — Modelo de datos e invariantes de los cambios comerciales posventa.
-- Estrictamente aditiva: una tabla nueva (cambios_venta), tres columnas
-- nuevas (ventas_caja.ventaOrigenId / vinculoTipo, cobros_venta.cambioVentaId)
-- con NULL en toda fila existente, una columna NOT NULL DEFAULT 0
-- (devoluciones_venta.importeCompensadoDecimal), CHECK nuevos que toda fila
-- existente ya cumple y triggers NUEVOS. No modifica ninguna migración
-- aplicada, ninguna función ni trigger existente, ninguna fila existente.
-- Ningún código productivo escribe todavía un cambio (servicio en F4-C4).
-- Reglas: codex-reports/F4_C_SALE_EXCHANGES.md §5–§10.

-- AlterTable
ALTER TABLE "cobros_venta" ADD COLUMN     "cambioVentaId" TEXT;

-- AlterTable
ALTER TABLE "devoluciones_venta" ADD COLUMN     "importeCompensadoDecimal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ventas_caja" ADD COLUMN     "ventaOrigenId" TEXT,
ADD COLUMN     "vinculoTipo" TEXT;

-- CreateTable
CREATE TABLE "cambios_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "ventaOrigenId" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "ventaNuevaId" TEXT NOT NULL,
    "importeSalidaDecimal" DECIMAL(12,2) NOT NULL,
    "importeEntradaDecimal" DECIMAL(12,2) NOT NULL,
    "creditoAplicadoDecimal" DECIMAL(12,2) NOT NULL,
    "diferenciaCobradaDecimal" DECIMAL(12,2) NOT NULL,
    "diferenciaReintegroDecimal" DECIMAL(12,2) NOT NULL,
    "liquidacion" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "turnoCajaId" TEXT,
    "motivo" TEXT NOT NULL,
    "advertencias" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambios_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cambios_venta_devolucionId_key" ON "cambios_venta"("devolucionId");

-- CreateIndex
CREATE UNIQUE INDEX "cambios_venta_ventaNuevaId_key" ON "cambios_venta"("ventaNuevaId");

-- CreateIndex
CREATE INDEX "cambios_venta_negocioId_createdAt_idx" ON "cambios_venta"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "cambios_venta_ventaOrigenId_idx" ON "cambios_venta"("ventaOrigenId");

-- CreateIndex
CREATE UNIQUE INDEX "cambios_venta_negocioId_idempotencyKey_key" ON "cambios_venta"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "cobros_venta_cambioVentaId_key" ON "cobros_venta"("cambioVentaId");

-- CreateIndex
CREATE INDEX "ventas_caja_ventaOrigenId_idx" ON "ventas_caja"("ventaOrigenId");

-- AddForeignKey
ALTER TABLE "ventas_caja" ADD CONSTRAINT "ventas_caja_ventaOrigenId_fkey" FOREIGN KEY ("ventaOrigenId") REFERENCES "ventas_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_venta" ADD CONSTRAINT "cobros_venta_cambioVentaId_fkey" FOREIGN KEY ("cambioVentaId") REFERENCES "cambios_venta"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_venta" ADD CONSTRAINT "cambios_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_venta" ADD CONSTRAINT "cambios_venta_ventaOrigenId_fkey" FOREIGN KEY ("ventaOrigenId") REFERENCES "ventas_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_venta" ADD CONSTRAINT "cambios_venta_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_venta"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_venta" ADD CONSTRAINT "cambios_venta_ventaNuevaId_fkey" FOREIGN KEY ("ventaNuevaId") REFERENCES "ventas_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_venta" ADD CONSTRAINT "cambios_venta_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 1. Importes de cada cambio (§5): no negativos, cuadran, una sola diferencia
-- ---------------------------------------------------------------------------
ALTER TABLE "cambios_venta"
  ADD CONSTRAINT "cambios_venta_importes_no_negativos_check" CHECK (
    "importeSalidaDecimal" >= 0 AND "importeEntradaDecimal" >= 0 AND "creditoAplicadoDecimal" >= 0
    AND "diferenciaCobradaDecimal" >= 0 AND "diferenciaReintegroDecimal" >= 0
  ),
  ADD CONSTRAINT "cambios_venta_importes_cuadran_check" CHECK (
    "importeSalidaDecimal" = "creditoAplicadoDecimal" + "diferenciaReintegroDecimal"
    AND "importeEntradaDecimal" = "creditoAplicadoDecimal" + "diferenciaCobradaDecimal"
    AND "creditoAplicadoDecimal" = LEAST("importeSalidaDecimal", "importeEntradaDecimal")
  ),
  ADD CONSTRAINT "cambios_venta_una_diferencia_check" CHECK (
    NOT ("diferenciaCobradaDecimal" > 0 AND "diferenciaReintegroDecimal" > 0)
  ),
  ADD CONSTRAINT "cambios_venta_liquidacion_check" CHECK (
    ("liquidacion" = 'SIN_DIFERENCIA' AND "diferenciaCobradaDecimal" = 0 AND "diferenciaReintegroDecimal" = 0)
    OR ("liquidacion" = 'COBRO' AND "diferenciaCobradaDecimal" > 0)
    OR ("liquidacion" = 'REINTEGRO' AND "diferenciaReintegroDecimal" > 0)
  ),
  ADD CONSTRAINT "cambios_venta_actor_check" CHECK (
    ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId" AND "empleadoId" IS NULL)
    OR ("actorTipo" = 'EMPLEADO' AND "empleadoId" IS NOT NULL AND "actorId" = "empleadoId")
  ),
  ADD CONSTRAINT "cambios_venta_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "cambios_venta_ventas_distintas_check" CHECK ("ventaOrigenId" <> "ventaNuevaId");

-- ---------------------------------------------------------------------------
-- 2. Venta vinculada: vínculo completo o ninguno; "CAMBIO" sólo en ventas de
--    cambio (toda venta existente: sin vínculo y metodoPago distinto de CAMBIO)
-- ---------------------------------------------------------------------------
ALTER TABLE "ventas_caja"
  ADD CONSTRAINT "ventas_caja_vinculo_check" CHECK (
    ("ventaOrigenId" IS NULL AND "vinculoTipo" IS NULL)
    OR ("ventaOrigenId" IS NOT NULL AND "vinculoTipo" IN ('CAMBIO', 'ADICIONAL') AND "ventaOrigenId" <> "id")
  ),
  ADD CONSTRAINT "ventas_caja_metodo_cambio_check" CHECK (
    ("metodoPago" = 'CAMBIO') = (COALESCE("vinculoTipo", '') = 'CAMBIO')
  );

-- ---------------------------------------------------------------------------
-- 3. Crédito interno: sólo CREDITO_CAMBIO lleva cambioVentaId (único por
--    cambio), nunca conciliación (toda fila existente: sin cambio, otro método)
-- ---------------------------------------------------------------------------
ALTER TABLE "cobros_venta"
  ADD CONSTRAINT "cobros_venta_credito_cambio_check" CHECK (
    ("metodo" = 'CREDITO_CAMBIO') = ("cambioVentaId" IS NOT NULL)
    AND ("cambioVentaId" IS NULL OR ("estadoConciliacion" = 'NO_APLICA' AND "importeDecimal" IS NOT NULL))
  );

-- ---------------------------------------------------------------------------
-- 4. Devolución: lo compensado nunca supera lo devuelto (toda fila existente: 0)
-- ---------------------------------------------------------------------------
ALTER TABLE "devoluciones_venta"
  ADD CONSTRAINT "devoluciones_venta_compensado_check" CHECK (
    "importeCompensadoDecimal" >= 0 AND "importeCompensadoDecimal" <= "importeDecimal"
  );


-- ---------------------------------------------------------------------------
-- 5. Cambio: mismo negocio en todos sus registros, importes iguales a los de
--    su devolución y su venta nueva, turno ABIERTO, inmutable
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_cambio_venta"() RETURNS trigger AS $$
DECLARE
  dev RECORD;
  nueva RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sale exchange is immutable';
  END IF;

  PERFORM 1 FROM "ventas_caja" WHERE "id" = NEW."ventaOrigenId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale exchange must reference a sale of the same business';
  END IF;

  SELECT "negocioId", "ventaId", "importeDecimal", "importeCompensadoDecimal" INTO dev
    FROM "devoluciones_venta" WHERE "id" = NEW."devolucionId";
  IF NOT FOUND OR dev."negocioId" <> NEW."negocioId" OR dev."ventaId" <> NEW."ventaOrigenId" THEN
    RAISE EXCEPTION 'sale exchange return must belong to the original sale of the same business';
  END IF;
  IF dev."importeDecimal" <> NEW."importeSalidaDecimal" OR dev."importeCompensadoDecimal" <> NEW."creditoAplicadoDecimal" THEN
    RAISE EXCEPTION 'sale exchange amounts must match its return';
  END IF;

  SELECT "negocioId", "ventaOrigenId", "vinculoTipo", COALESCE("totalDecimal", ROUND("total"::numeric, 2)) AS total INTO nueva
    FROM "ventas_caja" WHERE "id" = NEW."ventaNuevaId";
  IF NOT FOUND OR nueva."negocioId" <> NEW."negocioId"
     OR nueva."ventaOrigenId" IS DISTINCT FROM NEW."ventaOrigenId"
     OR nueva."vinculoTipo" IS DISTINCT FROM 'CAMBIO' THEN
    RAISE EXCEPTION 'sale exchange new sale must be an exchange sale linked to the original sale';
  END IF;
  IF nueva.total <> NEW."importeEntradaDecimal" THEN
    RAISE EXCEPTION 'sale exchange amounts must match its new sale';
  END IF;

  IF NEW."turnoCajaId" IS NOT NULL THEN
    PERFORM 1 FROM "turnos_caja" WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "estado" = 'ABIERTO';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale exchange requires an open shift of the same business';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cambios_venta_guard_trigger"
  BEFORE INSERT OR UPDATE ON "cambios_venta"
  FOR EACH ROW EXECUTE FUNCTION "guard_cambio_venta"();

-- Never deleted on its own (only together with its business, by cascade).
CREATE FUNCTION "guard_cambio_venta_delete"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
  IF FOUND THEN
    RAISE EXCEPTION 'sale exchange is immutable';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cambios_venta_delete_guard_trigger"
  BEFORE DELETE ON "cambios_venta"
  FOR EACH ROW EXECUTE FUNCTION "guard_cambio_venta_delete"();

-- Al confirmar: el crédito existe sólo si es > 0 y por su importe exacto, los
-- cobros reales de la venta nueva suman la diferencia cobrada, y la devolución
-- y la venta nueva tienen al menos una línea.
CREATE FUNCTION "check_cambio_venta_completo"() RETURNS trigger AS $$
DECLARE
  creditos INTEGER;
  credito NUMERIC;
  reales NUMERIC;
BEGIN
  SELECT COUNT(*), COALESCE(SUM("importeDecimal"), 0) INTO creditos, credito
    FROM "cobros_venta" WHERE "cambioVentaId" = NEW."id";
  IF (NEW."creditoAplicadoDecimal" > 0 AND (creditos <> 1 OR credito <> NEW."creditoAplicadoDecimal"))
     OR (NEW."creditoAplicadoDecimal" = 0 AND creditos <> 0) THEN
    RAISE EXCEPTION 'sale exchange internal credit must be exactly the applied credit';
  END IF;
  SELECT COALESCE(SUM(COALESCE("importeDecimal", ROUND("importe"::numeric, 2))), 0) INTO reales
    FROM "cobros_venta" WHERE "ventaId" = NEW."ventaNuevaId" AND "cambioVentaId" IS NULL;
  IF reales <> NEW."diferenciaCobradaDecimal" THEN
    RAISE EXCEPTION 'sale exchange real payments must equal the charged difference';
  END IF;
  PERFORM 1 FROM "devoluciones_venta_items" WHERE "devolucionId" = NEW."devolucionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale exchange return must have at least one line';
  END IF;
  PERFORM 1 FROM "venta_items" WHERE "ventaId" = NEW."ventaNuevaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale exchange new sale must have at least one line';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "cambios_venta_completo_trigger"
  AFTER INSERT ON "cambios_venta"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "check_cambio_venta_completo"();

-- ---------------------------------------------------------------------------
-- 6. Venta vinculada: origen del mismo negocio; el vínculo no cambia nunca;
--    una venta CAMBIO existe sólo con su cambio y con cobros = su total
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_venta_vinculo"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."ventaOrigenId" IS DISTINCT FROM OLD."ventaOrigenId" OR NEW."vinculoTipo" IS DISTINCT FROM OLD."vinculoTipo" THEN
      RAISE EXCEPTION 'sale link is immutable';
    END IF;
    RETURN NEW;
  END IF;
  PERFORM 1 FROM "ventas_caja" WHERE "id" = NEW."ventaOrigenId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'linked sale must reference a sale of the same business';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ventas_caja_vinculo_insert_trigger"
  BEFORE INSERT ON "ventas_caja"
  FOR EACH ROW WHEN (NEW."ventaOrigenId" IS NOT NULL)
  EXECUTE FUNCTION "guard_venta_vinculo"();

CREATE TRIGGER "ventas_caja_vinculo_update_trigger"
  BEFORE UPDATE OF "ventaOrigenId", "vinculoTipo" ON "ventas_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_venta_vinculo"();

CREATE FUNCTION "verificar_venta_cambio_completa"(venta_id TEXT) RETURNS void AS $$
DECLARE
  venta RECORD;
  cobrado NUMERIC;
BEGIN
  SELECT "id", "vinculoTipo", COALESCE("totalDecimal", ROUND("total"::numeric, 2)) AS total INTO venta
    FROM "ventas_caja" WHERE "id" = venta_id;
  IF NOT FOUND OR venta."vinculoTipo" IS DISTINCT FROM 'CAMBIO' THEN
    RETURN;
  END IF;
  PERFORM 1 FROM "cambios_venta" WHERE "ventaNuevaId" = venta."id";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'an exchange sale requires its exchange';
  END IF;
  SELECT COALESCE(SUM(COALESCE("importeDecimal", ROUND("importe"::numeric, 2))), 0) INTO cobrado
    FROM "cobros_venta" WHERE "ventaId" = venta."id";
  IF cobrado <> venta.total THEN
    RAISE EXCEPTION 'an exchange sale payments must equal its total';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "check_venta_cambio_completa"() RETURNS trigger AS $$
BEGIN
  PERFORM "verificar_venta_cambio_completa"(NEW."id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "check_cobro_venta_cambio_completa"() RETURNS trigger AS $$
BEGIN
  PERFORM "verificar_venta_cambio_completa"(NEW."ventaId");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ventas_caja_cambio_completa_trigger"
  AFTER INSERT ON "ventas_caja"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW."vinculoTipo" = 'CAMBIO')
  EXECUTE FUNCTION "check_venta_cambio_completa"();

CREATE CONSTRAINT TRIGGER "cobros_venta_cambio_completa_trigger"
  AFTER INSERT ON "cobros_venta"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "check_cobro_venta_cambio_completa"();

-- ---------------------------------------------------------------------------
-- 7. Crédito interno: de la venta nueva de SU cambio, por el crédito aplicado,
--    inmutable; nunca entra al libro financiero (no es ingreso)
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_cobro_credito_cambio"() RETURNS trigger AS $$
DECLARE
  cambio RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'exchange credit is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN
      RAISE EXCEPTION 'exchange credit is immutable';
    END IF;
    RETURN OLD;
  END IF;
  SELECT "negocioId", "ventaNuevaId", "creditoAplicadoDecimal" INTO cambio FROM "cambios_venta" WHERE "id" = NEW."cambioVentaId";
  IF NOT FOUND OR cambio."negocioId" <> NEW."negocioId" OR cambio."ventaNuevaId" <> NEW."ventaId" THEN
    RAISE EXCEPTION 'exchange credit must belong to the new sale of its exchange';
  END IF;
  IF cambio."creditoAplicadoDecimal" <= 0 OR NEW."importeDecimal" <> cambio."creditoAplicadoDecimal" THEN
    RAISE EXCEPTION 'exchange credit must equal the applied credit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cobros_venta_credito_insert_trigger"
  BEFORE INSERT ON "cobros_venta"
  FOR EACH ROW WHEN (NEW."cambioVentaId" IS NOT NULL)
  EXECUTE FUNCTION "guard_cobro_credito_cambio"();

CREATE TRIGGER "cobros_venta_credito_update_trigger"
  BEFORE UPDATE ON "cobros_venta"
  FOR EACH ROW WHEN (OLD."cambioVentaId" IS NOT NULL OR NEW."cambioVentaId" IS NOT NULL)
  EXECUTE FUNCTION "guard_cobro_credito_cambio"();

CREATE TRIGGER "cobros_venta_credito_delete_trigger"
  BEFORE DELETE ON "cobros_venta"
  FOR EACH ROW WHEN (OLD."cambioVentaId" IS NOT NULL)
  EXECUTE FUNCTION "guard_cobro_credito_cambio"();

CREATE FUNCTION "guard_operacion_sin_credito_cambio"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "cobros_venta" WHERE "id" = NEW."cobroVentaId" AND "metodo" = 'CREDITO_CAMBIO';
  IF FOUND THEN
    RAISE EXCEPTION 'an internal exchange credit never enters the ledger';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operaciones_financieras_credito_cambio_guard_trigger"
  BEFORE INSERT OR UPDATE OF "cobroVentaId" ON "operaciones_financieras"
  FOR EACH ROW WHEN (NEW."cobroVentaId" IS NOT NULL)
  EXECUTE FUNCTION "guard_operacion_sin_credito_cambio"();

-- ---------------------------------------------------------------------------
-- 8. Devolución: lo compensado no cambia nunca, sólo existe con su cambio, y
--    un reintegro en efectivo sale por EXACTAMENTE lo reintegrable
--    (importe − compensado; hoy compensado = 0 → idéntico a F4-A)
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_devolucion_compensado"() RETURNS trigger AS $$
BEGIN
  IF NEW."importeCompensadoDecimal" IS DISTINCT FROM OLD."importeCompensadoDecimal" THEN
    RAISE EXCEPTION 'sale return compensated amount is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "devoluciones_venta_compensado_guard_trigger"
  BEFORE UPDATE OF "importeCompensadoDecimal" ON "devoluciones_venta"
  FOR EACH ROW EXECUTE FUNCTION "guard_devolucion_compensado"();

CREATE FUNCTION "check_devolucion_compensada"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "cambios_venta" WHERE "devolucionId" = NEW."id";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a compensated sale return requires its exchange';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "devoluciones_venta_compensada_trigger"
  AFTER INSERT ON "devoluciones_venta"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW."importeCompensadoDecimal" > 0)
  EXECUTE FUNCTION "check_devolucion_compensada"();

CREATE FUNCTION "guard_devolucion_reintegro_importe"() RETURNS trigger AS $$
DECLARE
  salida NUMERIC;
BEGIN
  SELECT COALESCE(SUM(COALESCE("importeDecimal", ROUND("importe"::numeric, 2))), 0) INTO salida
    FROM "movimientos_financieros" WHERE "operacionId" = NEW."reintegroOperacionId";
  IF salida <> -(NEW."importeDecimal" - NEW."importeCompensadoDecimal") THEN
    RAISE EXCEPTION 'sale return cash refund must equal the refundable amount';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "devoluciones_venta_reintegro_importe_trigger"
  BEFORE INSERT OR UPDATE OF "reintegroOperacionId" ON "devoluciones_venta"
  FOR EACH ROW WHEN (NEW."reintegroOperacionId" IS NOT NULL)
  EXECUTE FUNCTION "guard_devolucion_reintegro_importe"();
