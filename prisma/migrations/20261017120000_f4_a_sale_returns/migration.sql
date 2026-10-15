-- F4-A — Anulaciones y devoluciones parciales de ventas de Caja.
-- Aditiva: dos tablas nuevas de eventos de compensación, sus invariantes y una
-- guarda para la salida de efectivo. No modifica ventas_caja, venta_items,
-- cobros_venta, operaciones existentes ni cierres de turno.

-- CreateTable
CREATE TABLE "devoluciones_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "metodoPagoVenta" TEXT NOT NULL,
    "reintegroEstado" TEXT NOT NULL,
    "reintegroMedio" TEXT,
    "reintegroRegistradoEn" TIMESTAMP(3),
    "reintegroActorTipo" TEXT,
    "reintegroActorId" TEXT,
    "reintegroOperacionId" TEXT,
    "reintegroTurnoCajaId" TEXT,
    "reintegroIdempotencyKey" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_venta_items" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "ventaItemId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "stockResultado" TEXT NOT NULL,
    "movimientoInventarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_reintegroOperacionId_key" ON "devoluciones_venta"("reintegroOperacionId");

-- CreateIndex
CREATE INDEX "devoluciones_venta_negocioId_createdAt_idx" ON "devoluciones_venta"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "devoluciones_venta_ventaId_idx" ON "devoluciones_venta"("ventaId");

-- CreateIndex
CREATE INDEX "devoluciones_venta_reintegroTurnoCajaId_idx" ON "devoluciones_venta"("reintegroTurnoCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_negocioId_idempotencyKey_key" ON "devoluciones_venta"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_negocioId_reintegroIdempotencyKey_key" ON "devoluciones_venta"("negocioId", "reintegroIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_venta_items_movimientoInventarioId_key" ON "devoluciones_venta_items"("movimientoInventarioId");

-- CreateIndex
CREATE INDEX "devoluciones_venta_items_ventaItemId_idx" ON "devoluciones_venta_items"("ventaItemId");

-- CreateIndex
CREATE INDEX "devoluciones_venta_items_devolucionId_idx" ON "devoluciones_venta_items"("devolucionId");

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_reintegroOperacionId_fkey" FOREIGN KEY ("reintegroOperacionId") REFERENCES "operaciones_financieras"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta" ADD CONSTRAINT "devoluciones_venta_reintegroTurnoCajaId_fkey" FOREIGN KEY ("reintegroTurnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta_items" ADD CONSTRAINT "devoluciones_venta_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta_items" ADD CONSTRAINT "devoluciones_venta_items_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "venta_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_venta_items" ADD CONSTRAINT "devoluciones_venta_items_movimientoInventarioId_fkey" FOREIGN KEY ("movimientoInventarioId") REFERENCES "movimientos_inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Coherencia de cada evento
-- ---------------------------------------------------------------------------
ALTER TABLE "devoluciones_venta"
  ADD CONSTRAINT "devoluciones_venta_tipo_check" CHECK ("tipo" IN ('ANULACION', 'DEVOLUCION_PARCIAL')),
  ADD CONSTRAINT "devoluciones_venta_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "devoluciones_venta_actor_check" CHECK (
    ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId" AND "empleadoId" IS NULL)
    OR ("actorTipo" = 'EMPLEADO' AND "empleadoId" IS NOT NULL AND "actorId" = "empleadoId")
  ),
  ADD CONSTRAINT "devoluciones_venta_importe_check" CHECK ("importeDecimal" >= 0),
  ADD CONSTRAINT "devoluciones_venta_metodo_check" CHECK ("metodoPagoVenta" IN ('EFECTIVO', 'TRANSFERENCIA', 'OTRO')),
  -- Un reintegro sólo figura REALIZADO con medio, fecha y actor; en EFECTIVO
  -- exige su operación financiera (nunca "realizado" sin respaldo).
  ADD CONSTRAINT "devoluciones_venta_reintegro_check" CHECK (
    (
      "reintegroEstado" IN ('NO_CORRESPONDE', 'PENDIENTE')
      AND "reintegroMedio" IS NULL AND "reintegroRegistradoEn" IS NULL
      AND "reintegroActorTipo" IS NULL AND "reintegroActorId" IS NULL
      AND "reintegroOperacionId" IS NULL AND "reintegroTurnoCajaId" IS NULL
      AND "reintegroIdempotencyKey" IS NULL
    )
    OR (
      "reintegroEstado" = 'REALIZADO'
      AND "reintegroMedio" IN ('EFECTIVO', 'TRANSFERENCIA', 'OTRO')
      AND "reintegroRegistradoEn" IS NOT NULL
      AND "reintegroActorTipo" IN ('NEGOCIO', 'EMPLEADO') AND "reintegroActorId" IS NOT NULL
      AND ("reintegroMedio" = 'EFECTIVO') = ("reintegroOperacionId" IS NOT NULL)
      AND ("reintegroTurnoCajaId" IS NULL OR "reintegroOperacionId" IS NOT NULL)
    )
  );

ALTER TABLE "devoluciones_venta_items"
  ADD CONSTRAINT "devoluciones_venta_items_cantidad_check" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "devoluciones_venta_items_importe_check" CHECK ("importeDecimal" >= 0),
  ADD CONSTRAINT "devoluciones_venta_items_stock_check" CHECK (
    "stockResultado" IN ('REINGRESADO', 'NO_REINGRESA', 'SIN_CONTROL_STOCK', 'PRODUCTO_NO_DISPONIBLE')
    AND ("movimientoInventarioId" IS NULL OR "stockResultado" = 'REINGRESADO')
  );

-- ---------------------------------------------------------------------------
-- Evento: pertenencia al negocio e inmutabilidad (sólo PENDIENTE -> REALIZADO)
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_devolucion_venta"() RETURNS trigger AS $$
DECLARE
  op RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
       OR NEW."ventaId" IS DISTINCT FROM OLD."ventaId"
       OR NEW."tipo" IS DISTINCT FROM OLD."tipo"
       OR NEW."motivo" IS DISTINCT FROM OLD."motivo"
       OR NEW."actorTipo" IS DISTINCT FROM OLD."actorTipo"
       OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
       OR NEW."empleadoId" IS DISTINCT FROM OLD."empleadoId"
       OR NEW."importeDecimal" IS DISTINCT FROM OLD."importeDecimal"
       OR NEW."metodoPagoVenta" IS DISTINCT FROM OLD."metodoPagoVenta"
       OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
       OR NEW."idempotencyFingerprint" IS DISTINCT FROM OLD."idempotencyFingerprint"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
       OR NOT (OLD."reintegroEstado" = 'PENDIENTE' AND NEW."reintegroEstado" = 'REALIZADO') THEN
      RAISE EXCEPTION 'sale return is immutable';
    END IF;
  ELSE
    PERFORM 1 FROM "ventas_caja" WHERE "id" = NEW."ventaId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale return must reference a sale of the same business';
    END IF;
  END IF;

  IF NEW."reintegroTurnoCajaId" IS NOT NULL THEN
    PERFORM 1 FROM "turnos_caja" WHERE "id" = NEW."reintegroTurnoCajaId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale return refund shift must belong to the same business';
    END IF;
  END IF;
  IF NEW."reintegroOperacionId" IS NOT NULL THEN
    SELECT "negocioId", "tipo", "turnoCajaId" INTO op FROM "operaciones_financieras" WHERE "id" = NEW."reintegroOperacionId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale return refund operation is inconsistent';
    END IF;
    IF op."negocioId" <> NEW."negocioId" OR op."tipo" <> 'DEVOLUCION_VENTA'
       OR op."turnoCajaId" IS DISTINCT FROM NEW."reintegroTurnoCajaId" THEN
      RAISE EXCEPTION 'sale return refund operation is inconsistent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "devoluciones_venta_guard_trigger"
  BEFORE INSERT OR UPDATE ON "devoluciones_venta"
  FOR EACH ROW EXECUTE FUNCTION "guard_devolucion_venta"();

-- ---------------------------------------------------------------------------
-- Líneas: nunca más unidades ni más importe que lo vendido (acumulado), con
-- la fila de venta_items bloqueada; inmutables salvo el SET NULL de su
-- movimiento de inventario cuando se borra el producto.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_devolucion_venta_item"() RETURNS trigger AS $$
DECLARE
  dev RECORD;
  vendido RECORD;
  previo RECORD;
  mov RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."devolucionId" IS DISTINCT FROM OLD."devolucionId"
       OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
       OR NEW."ventaId" IS DISTINCT FROM OLD."ventaId"
       OR NEW."ventaItemId" IS DISTINCT FROM OLD."ventaItemId"
       OR NEW."cantidad" IS DISTINCT FROM OLD."cantidad"
       OR NEW."importeDecimal" IS DISTINCT FROM OLD."importeDecimal"
       OR NEW."stockResultado" IS DISTINCT FROM OLD."stockResultado"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
       OR (NEW."movimientoInventarioId" IS DISTINCT FROM OLD."movimientoInventarioId" AND NEW."movimientoInventarioId" IS NOT NULL) THEN
      RAISE EXCEPTION 'sale return line is immutable';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "negocioId", "ventaId" INTO dev FROM "devoluciones_venta" WHERE "id" = NEW."devolucionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale return line must match its return event';
  END IF;
  IF dev."negocioId" <> NEW."negocioId" OR dev."ventaId" <> NEW."ventaId" THEN
    RAISE EXCEPTION 'sale return line must match its return event';
  END IF;

  SELECT "cantidad"::numeric AS cantidad,
         COALESCE("subtotalDecimal", ROUND("subtotal"::numeric, 2)) AS subtotal
    INTO vendido
    FROM "venta_items"
   WHERE "id" = NEW."ventaItemId" AND "ventaId" = NEW."ventaId"
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale return line must reference a line of the same sale';
  END IF;

  SELECT COALESCE(SUM("cantidad"::numeric), 0) AS cantidad, COALESCE(SUM("importeDecimal"), 0) AS importe
    INTO previo
    FROM "devoluciones_venta_items"
   WHERE "ventaItemId" = NEW."ventaItemId";
  IF previo.cantidad + NEW."cantidad"::numeric > vendido.cantidad THEN
    RAISE EXCEPTION 'sale return quantity exceeds the sold quantity';
  END IF;
  IF previo.importe + NEW."importeDecimal" > vendido.subtotal THEN
    RAISE EXCEPTION 'sale return amount exceeds the charged amount';
  END IF;

  IF NEW."movimientoInventarioId" IS NOT NULL THEN
    SELECT "negocioId", "tipo", "ventaId" INTO mov FROM "movimientos_inventario" WHERE "id" = NEW."movimientoInventarioId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale return stock movement is inconsistent';
    END IF;
    IF mov."negocioId" <> NEW."negocioId" OR mov."tipo" <> 'DEVOLUCION' OR mov."ventaId" IS DISTINCT FROM NEW."ventaId" THEN
      RAISE EXCEPTION 'sale return stock movement is inconsistent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "devoluciones_venta_items_guard_trigger"
  BEFORE INSERT OR UPDATE ON "devoluciones_venta_items"
  FOR EACH ROW EXECUTE FUNCTION "guard_devolucion_venta_item"();

-- ---------------------------------------------------------------------------
-- Libro: la salida de efectivo de una devolución sólo se atribuye a un turno
-- ABIERTO del mismo negocio (un cierre histórico nunca cambia).
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_operacion_devolucion_venta"() RETURNS trigger AS $$
BEGIN
  IF NEW."tipo" = 'DEVOLUCION_VENTA' AND NEW."turnoCajaId" IS NOT NULL THEN
    PERFORM 1 FROM "turnos_caja"
     WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "estado" = 'ABIERTO';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale return cash refund requires an open shift';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operaciones_financieras_devolucion_guard_trigger"
  BEFORE INSERT OR UPDATE OF "tipo", "turnoCajaId", "negocioId" ON "operaciones_financieras"
  FOR EACH ROW EXECUTE FUNCTION "guard_operacion_devolucion_venta"();
