-- F4-B — Corrección administrativa de ventas de Caja (sólo dueño).
-- Aditiva: dos tablas nuevas de eventos inmutables, una columna nullable de
-- vínculo en movimientos_inventario y sus invariantes. No modifica ninguna fila
-- existente de ventas, líneas, cobros, operaciones, turnos ni devoluciones.
-- Además reemplaza (CREATE OR REPLACE, sin editar la migración F4-A aplicada)
-- el guard de líneas de devolución para que use la cantidad/importe vigentes de
-- una línea corregida; sin correcciones su comportamiento es idéntico.

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "correccionVentaId" TEXT;

-- CreateTable
CREATE TABLE "correcciones_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "totalDecimal" DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correcciones_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correcciones_venta_lineas" (
    "id" TEXT NOT NULL,
    "correccionId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "ventaItemId" TEXT NOT NULL,
    "antesProductoId" TEXT,
    "antesProductoVarianteId" TEXT,
    "antesNombre" TEXT NOT NULL,
    "antesVarianteNombre" TEXT,
    "antesCantidad" DOUBLE PRECISION NOT NULL,
    "productoId" TEXT,
    "productoVarianteId" TEXT,
    "nombre" TEXT NOT NULL,
    "varianteNombre" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "subtotalDecimal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correcciones_venta_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correcciones_venta_negocioId_createdAt_idx" ON "correcciones_venta"("negocioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "correcciones_venta_negocioId_idempotencyKey_key" ON "correcciones_venta"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "correcciones_venta_ventaId_secuencia_key" ON "correcciones_venta"("ventaId", "secuencia");

-- CreateIndex
CREATE INDEX "correcciones_venta_lineas_ventaItemId_idx" ON "correcciones_venta_lineas"("ventaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "correcciones_venta_lineas_correccionId_ventaItemId_key" ON "correcciones_venta_lineas"("correccionId", "ventaItemId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_correccionVentaId_idx" ON "movimientos_inventario"("correccionVentaId");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_correccionVentaId_fkey" FOREIGN KEY ("correccionVentaId") REFERENCES "correcciones_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_venta" ADD CONSTRAINT "correcciones_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_venta" ADD CONSTRAINT "correcciones_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_venta_lineas" ADD CONSTRAINT "correcciones_venta_lineas_correccionId_fkey" FOREIGN KEY ("correccionId") REFERENCES "correcciones_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_venta_lineas" ADD CONSTRAINT "correcciones_venta_lineas_ventaItemId_fkey" FOREIGN KEY ("ventaItemId") REFERENCES "venta_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Coherencia del evento de corrección (sólo dueño, motivo, secuencia)
-- ---------------------------------------------------------------------------
ALTER TABLE "correcciones_venta"
  ADD CONSTRAINT "correcciones_venta_actor_check" CHECK ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId"),
  ADD CONSTRAINT "correcciones_venta_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "correcciones_venta_secuencia_check" CHECK ("secuencia" > 0),
  ADD CONSTRAINT "correcciones_venta_total_check" CHECK ("totalDecimal" >= 0);

ALTER TABLE "correcciones_venta_lineas"
  ADD CONSTRAINT "correcciones_venta_lineas_cantidades_check" CHECK ("cantidad" >= 0 AND "antesCantidad" >= 0 AND "subtotalDecimal" >= 0);

-- ---------------------------------------------------------------------------
-- Evento: misma empresa, total cobrado intacto, nunca sobre ventas con
-- devoluciones/anulaciones, inmutable.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_correccion_venta"() RETURNS trigger AS $$
DECLARE
  cobrado NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sale correction is immutable';
  END IF;

  SELECT COALESCE("totalDecimal", ROUND("total"::numeric, 2)) INTO cobrado
    FROM "ventas_caja"
   WHERE "id" = NEW."ventaId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale correction must reference a sale of the same business';
  END IF;
  IF NEW."totalDecimal" <> cobrado THEN
    RAISE EXCEPTION 'sale correction must keep the charged total';
  END IF;
  PERFORM 1 FROM "devoluciones_venta" WHERE "ventaId" = NEW."ventaId";
  IF FOUND THEN
    RAISE EXCEPTION 'sale correction is not allowed on a sale with returns';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "correcciones_venta_guard_trigger"
  BEFORE INSERT OR UPDATE ON "correcciones_venta"
  FOR EACH ROW EXECUTE FUNCTION "guard_correccion_venta"();

-- ---------------------------------------------------------------------------
-- Líneas: de la misma venta, precio unitario = el efectivamente cobrado,
-- inmutables.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_correccion_venta_linea"() RETURNS trigger AS $$
DECLARE
  cab RECORD;
  item RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sale correction line is immutable';
  END IF;

  SELECT "negocioId", "ventaId" INTO cab FROM "correcciones_venta" WHERE "id" = NEW."correccionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale correction line must match its correction';
  END IF;
  IF cab."negocioId" <> NEW."negocioId" OR cab."ventaId" <> NEW."ventaId" THEN
    RAISE EXCEPTION 'sale correction line must match its correction';
  END IF;

  SELECT "precio" INTO item FROM "venta_items" WHERE "id" = NEW."ventaItemId" AND "ventaId" = NEW."ventaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale correction line must reference a line of the same sale';
  END IF;
  IF item."precio" <> NEW."precio" THEN
    RAISE EXCEPTION 'sale correction must keep the charged unit price';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "correcciones_venta_lineas_guard_trigger"
  BEFORE INSERT OR UPDATE ON "correcciones_venta_lineas"
  FOR EACH ROW EXECUTE FUNCTION "guard_correccion_venta_linea"();

-- Al confirmar la transacción: una línea por cada línea de la venta y suma
-- exacta igual al total cobrado.
CREATE FUNCTION "check_correccion_venta_completa"() RETURNS trigger AS $$
DECLARE
  cab RECORD;
  suma NUMERIC;
  lineas INTEGER;
  items INTEGER;
BEGIN
  SELECT "ventaId", "totalDecimal" INTO cab FROM "correcciones_venta" WHERE "id" = NEW."correccionId";
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(SUM("subtotalDecimal"), 0), COUNT(*) INTO suma, lineas
    FROM "correcciones_venta_lineas" WHERE "correccionId" = NEW."correccionId";
  SELECT COUNT(*) INTO items FROM "venta_items" WHERE "ventaId" = cab."ventaId";
  IF lineas <> items OR suma <> cab."totalDecimal" THEN
    RAISE EXCEPTION 'sale correction lines must cover the sale and keep its total';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "correcciones_venta_lineas_completa_trigger"
  AFTER INSERT ON "correcciones_venta_lineas"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "check_correccion_venta_completa"();

-- ---------------------------------------------------------------------------
-- F4-A coordinado con F4-B: el tope de una devolución usa la cantidad y el
-- importe VIGENTES de la línea (la última corrección, si existe). Para una
-- venta sin correcciones el comportamiento es idéntico al de F4-A.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "guard_devolucion_venta_item"() RETURNS trigger AS $$
DECLARE
  dev RECORD;
  vendido RECORD;
  vigente RECORD;
  vend_cantidad NUMERIC;
  vend_subtotal NUMERIC;
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
  vend_cantidad := vendido.cantidad;
  vend_subtotal := vendido.subtotal;

  SELECT l."cantidad"::numeric AS cantidad, l."subtotalDecimal" AS subtotal
    INTO vigente
    FROM "correcciones_venta_lineas" AS l
    JOIN "correcciones_venta" AS c ON c."id" = l."correccionId"
   WHERE l."ventaItemId" = NEW."ventaItemId"
   ORDER BY c."secuencia" DESC
   LIMIT 1;
  IF FOUND THEN
    vend_cantidad := vigente.cantidad;
    vend_subtotal := vigente.subtotal;
  END IF;

  SELECT COALESCE(SUM("cantidad"::numeric), 0) AS cantidad, COALESCE(SUM("importeDecimal"), 0) AS importe
    INTO previo
    FROM "devoluciones_venta_items"
   WHERE "ventaItemId" = NEW."ventaItemId";
  IF previo.cantidad + NEW."cantidad"::numeric > vend_cantidad THEN
    RAISE EXCEPTION 'sale return quantity exceeds the sold quantity';
  END IF;
  IF previo.importe + NEW."importeDecimal" > vend_subtotal THEN
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
